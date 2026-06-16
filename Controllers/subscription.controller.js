const Subscriptions = require("../Models/Subscription.Schema")
const Invoices = require("../Models/Invoice.Schema")
const { generateInvoiceNumber } = require("../Utils/invoiceNumber.util")

// List subscriptions with status, paymentStatus, billingCycle filters and pagination
const getAllSubscriptions = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, paymentStatus, billingCycle } = req.query
        const query = {}
        if (status) query.status = status
        if (paymentStatus) query.paymentStatus = paymentStatus
        if (billingCycle) query.billingCycle = billingCycle

        const skip = (Number(page) - 1) * Number(limit)
        const [subscriptions, total] = await Promise.all([
            Subscriptions.find(query)
                .populate("customer", "name phone email")
                .populate("softwares", "name type price")
                .populate("createdBy", "name")
                .sort({ renewalDate: 1 })
                .skip(skip)
                .limit(Number(limit)),
            Subscriptions.countDocuments(query),
        ])

        res.status(200).json({
            success: true,
            message: "Subscriptions fetched",
            data: subscriptions,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createSubscription = async (req, res) => {
    try {
        const { customer, softwares, renewalDate, amountCharged } = req.body
        if (!customer || !softwares || !renewalDate || !amountCharged) {
            return res.status(400).json({ success: false, message: "customer, softwares, renewalDate, and amountCharged are required" })
        }

        const subscription = new Subscriptions({ ...req.body, createdBy: req.user.id })
        await subscription.save()

        // Auto-generate a NewPurchase invoice for every new subscription
        const invoiceNumber = await generateInvoiceNumber()
        const invoice = new Invoices({
            invoiceNumber,
            customer: subscription.customer,
            subscription: subscription._id,
            software: subscription.softwares,
            amount: subscription.amountCharged,
            totalAmount: subscription.amountCharged,
            invoiceType: "NewPurchase",
            periodFrom: subscription.buyDate || new Date(),
            periodTo: new Date(subscription.renewalDate),
            paymentStatus: subscription.paymentStatus || "Pending",
            createdBy: req.user.id,
        })
        await invoice.save()

        res.status(201).json({ success: true, message: "Subscription created", data: { subscription, invoice } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getSubscriptionById = async (req, res) => {
    try {
        const subscription = await Subscriptions.findById(req.params.id)
            .populate("customer", "name phone email")
            .populate("softwares", "name type price billingCycle")
            .populate("createdBy", "name email")

        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" })
        }
        res.status(200).json({ success: true, message: "Subscription fetched", data: subscription })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateSubscription = async (req, res) => {
    try {
        const subscription = await Subscriptions.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" })
        }
        res.status(200).json({ success: true, message: "Subscription updated", data: subscription })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Plan rule: cannot delete subscription that has paid invoices
const deleteSubscription = async (req, res) => {
    try {
        const paidCount = await Invoices.countDocuments({ subscription: req.params.id, paymentStatus: "Paid" })
        if (paidCount > 0) {
            return res.status(400).json({ success: false, message: "Cannot delete subscription with paid invoices" })
        }

        const subscription = await Subscriptions.findByIdAndDelete(req.params.id)
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" })
        }
        res.status(200).json({ success: true, message: "Subscription deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Renew: update dates, reset reminder flags, and auto-create a Renewal invoice
const renewSubscription = async (req, res) => {
    try {
        const { renewalDate, amountCharged, paymentStatus = "Paid" } = req.body
        if (!renewalDate) {
            return res.status(400).json({ success: false, message: "renewalDate is required" })
        }

        const subscription = await Subscriptions.findById(req.params.id)
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" })
        }

        subscription.lastRenewedDate = new Date()
        subscription.renewalDate = renewalDate
        if (amountCharged) subscription.amountCharged = amountCharged
        subscription.paymentStatus = paymentStatus
        subscription.status = "Active"
        subscription.reminderSent = { thirtyDays: false, sevenDays: false, oneDay: false, overdue: false }
        await subscription.save()

        const invoiceNumber = await generateInvoiceNumber()
        const invoice = new Invoices({
            invoiceNumber,
            customer: subscription.customer,
            subscription: subscription._id,
            software: subscription.softwares,
            amount: subscription.amountCharged,
            totalAmount: subscription.amountCharged,
            invoiceType: "Renewal",
            periodFrom: new Date(),
            periodTo: new Date(renewalDate),
            paymentStatus,
            createdBy: req.user.id,
        })
        await invoice.save()

        res.status(200).json({ success: true, message: "Subscription renewed", data: { subscription, invoice } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllSubscriptions,
    createSubscription,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    renewSubscription,
}
