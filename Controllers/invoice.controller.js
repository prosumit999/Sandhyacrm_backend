const Invoices = require("../Models/Invoice.Schema")
const { generateInvoiceNumber } = require("../Utils/invoiceNumber.util")

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

        const invoice = await Invoices.findByIdAndUpdate(
            req.params.id,
            { paymentStatus: "Paid", paymentMethod, transactionId, paymentDate: paymentDate || new Date() },
            { new: true }
        )
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" })
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
