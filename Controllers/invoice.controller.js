const Invoices    = require("../Models/Invoice.Schema")
const Customers   = require("../Models/Customer.model")
const Softwares   = require("../Models/Softwares.schema")
const { generateInvoiceNumber } = require("../Utils/invoiceNumber.util")
const { sendDetailedInvoiceEmail, sendPaymentConfirmationEmail } = require("../Services/email.service")
const { logEmailSent } = require("../Services/auditlog.service")
const { createPortalNotification } = require("../Services/portalNotification.service")

// List invoices with paymentStatus, invoiceType, customer filters and pagination
const getAllInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 20, paymentStatus, invoiceType, customer } = req.query
        const query = {}
        if (paymentStatus) query.paymentStatus = paymentStatus
        if (invoiceType) query.invoiceType = invoiceType
        if (customer) query.customer = customer

        const skip = (Number(page) - 1) * Number(limit)
        const [invoices, total] = await Promise.all([
            Invoices.find(query)
                .populate("customer", "name phone email")
                .populate("software", "name type")
                .populate("subscription", "billingCycle renewalDate")
                .populate("createdBy", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Invoices.countDocuments(query),
        ])

        res.status(200).json({
            success: true,
            message: "Invoices fetched",
            data: invoices,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Invoice number format: INV-YYYY-XXXXXX — replace with invoiceNumber.util once built
const createInvoice = async (req, res) => {
    try {
        const { customer, subscription, software, amount, totalAmount, periodFrom, periodTo } = req.body
        if (!customer || !subscription || !software || !amount || !totalAmount || !periodFrom || !periodTo) {
            return res.status(400).json({
                success: false,
                message: "customer, subscription, software, amount, totalAmount, periodFrom, and periodTo are required",
            })
        }

        const invoiceNumber = await generateInvoiceNumber()
        const invoice = new Invoices({ ...req.body, invoiceNumber, createdBy: req.user.id })
        await invoice.save()

        // Email customer the full invoice details — only for SuperAdmin / Admin
        if (req.user.role !== "Standard" && process.env.EMAIL_SEND_INVOICE === "true") {
            Promise.all([
                Customers.findById(customer),
                Softwares.findById(req.body.software).select("name type"),
            ]).then(([cust, soft]) => {
                if (!cust?.email) return
                sendDetailedInvoiceEmail(cust.email, {
                    customerName:  cust.name,
                    invoiceNumber,
                    softwareName:  soft?.name,
                    softwareType:  soft?.type,
                    amount:        req.body.amount,
                    tax:           req.body.tax,
                    discount:      req.body.discount,
                    totalAmount:   req.body.totalAmount,
                    invoiceType:   req.body.invoiceType,
                    periodFrom:    req.body.periodFrom,
                    periodTo:      req.body.periodTo,
                    paymentStatus: req.body.paymentStatus,
                    dueDate:       req.body.dueDate,
                })
                .then(() => logEmailSent(req.user.id, { to: cust.email, subject: `Invoice ${invoiceNumber}`, type: "InvoiceGenerated", targetId: cust._id, targetModel: "Customers", targetLabel: cust.name, ipAddress: req.ip }))
                .catch(() => {})
            }).catch(() => {})
        }

        // Portal notification for the customer
        const amt = `₹${Number(req.body.totalAmount || req.body.amount || 0).toLocaleString("en-IN")}`
        createPortalNotification({
            customer: customer,
            type:    "InvoiceCreated",
            title:   "New invoice issued",
            message: `A new invoice of ${amt} (${invoiceNumber}) has been issued for your account.`,
            link:    "/portal/invoices",
        })

        res.status(201).json({ success: true, message: "Invoice created", data: invoice })
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: "Invoice number conflict, please retry" })
        }
        res.status(500).json({ success: false, message: err.message })
    }
}

const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoices.findById(req.params.id)
            .populate("customer", "name phone email address businessName")
            .populate("software", "name type")
            .populate("subscription", "billingCycle renewalDate amountCharged")
            .populate("createdBy", "name email")

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }
        res.status(200).json({ success: true, message: "Invoice fetched", data: invoice })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Edit is only allowed while the invoice is still Pending
const updateInvoice = async (req, res) => {
    try {
        const invoice = await Invoices.findById(req.params.id)
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }
        if (invoice.paymentStatus !== "Pending") {
            return res.status(400).json({ success: false, message: "Only pending invoices can be edited" })
        }

        const updated = await Invoices.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        res.status(200).json({ success: true, message: "Invoice updated", data: updated })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Record payment details and flip status to Paid
const markInvoicePaid = async (req, res) => {
    try {
        const { paymentMethod, transactionId, paymentDate } = req.body
        if (!paymentMethod) {
            return res.status(400).json({ success: false, message: "paymentMethod is required" })
        }

        const paidDate = paymentDate || new Date()
        const invoice = await Invoices.findByIdAndUpdate(
            req.params.id,
            { paymentStatus: "Paid", paymentMethod, transactionId, paymentDate: paidDate },
            { new: true }
        ).populate("customer", "name email")

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
        }

        // Email payment confirmation when EMAIL_SEND_PAYMENT_CONFIRMATION is enabled
        if (process.env.EMAIL_SEND_PAYMENT_CONFIRMATION === "true" && invoice.customer?.email) {
            sendPaymentConfirmationEmail(invoice.customer.email, {
                customerName:  invoice.customer.name,
                invoiceNumber: invoice.invoiceNumber,
                totalAmount:   invoice.totalAmount,
                paymentDate:   paidDate,
                paymentMethod,
            })
            .then(() => logEmailSent(req.user.id, { to: invoice.customer.email, subject: `Payment Confirmed — ${invoice.invoiceNumber}`, type: "PaymentConfirmation", targetId: invoice.customer._id, targetModel: "Customers", targetLabel: invoice.customer.name, ipAddress: req.ip }))
            .catch(() => {})
        }

        res.status(200).json({ success: true, message: "Invoice marked as paid", data: invoice })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllInvoices,
    createInvoice,
    getInvoiceById,
    updateInvoice,
    markInvoicePaid,
}
