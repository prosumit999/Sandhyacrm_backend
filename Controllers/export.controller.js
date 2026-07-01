const Customers = require("../Models/Customer.model")
const Invoices = require("../Models/Invoice.Schema")
const Subscriptions = require("../Models/Subscription.Schema")
const AuditLogs = require("../Models/AuditLog.schema")
const { buildDateRange, sendExport } = require("../Utils/export.util")

const customerColumns = [
    { key: "_id", label: "Customer ID" },
    { key: "name", label: "Name" },
    { key: "businessName", label: "Business Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "status", label: "Status" },
    { key: "Subscriptions", label: "Subscription Type" },
    { key: "serviceUser.name", label: "Service User" },
    { key: "address.city", label: "City" },
    { key: "address.state", label: "State" },
    { key: "address.country", label: "Country" },
    { key: "referrredBy", label: "Referred By" },
    { key: "createdAt", label: "Created At" },
]

const invoiceColumns = [
    { key: "_id", label: "Invoice ID" },
    { key: "invoiceNumber", label: "Invoice Number" },
    { key: "customer.name", label: "Customer" },
    { key: "software.name", label: "Software" },
    { key: "subscription._id", label: "Subscription ID" },
    { key: "invoiceType", label: "Invoice Type" },
    { key: "amount", label: "Amount" },
    { key: "tax", label: "Tax" },
    { key: "discount", label: "Discount" },
    { key: "totalAmount", label: "Total Amount" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "paymentMethod", label: "Payment Method" },
    { key: "transactionId", label: "Transaction ID" },
    { key: "periodFrom", label: "Period From" },
    { key: "periodTo", label: "Period To" },
    { key: "paymentDate", label: "Payment Date" },
    { key: "createdBy.name", label: "Created By" },
    { key: "createdAt", label: "Created At" },
]

const subscriptionColumns = [
    { key: "_id", label: "Subscription ID" },
    { key: "customer.name", label: "Customer" },
    { key: "softwares.name", label: "Software" },
    { key: "buyDate", label: "Buy Date" },
    { key: "renewalDate", label: "Renewal Date" },
    { key: "lastRenewedDate", label: "Last Renewed Date" },
    { key: "amountCharged", label: "Amount Charged" },
    { key: "billingCycle", label: "Billing Cycle" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "status", label: "Status" },
    { key: "createdBy.name", label: "Created By" },
    { key: "createdAt", label: "Created At" },
]

const auditColumns = [
    { key: "_id", label: "Audit ID" },
    { key: "createdAt", label: "Created At" },
    { key: "category", label: "Category" },
    { key: "action", label: "Action" },
    { key: "severity", label: "Severity" },
    { key: "performedBy.name", label: "Performed By" },
    { key: "performedBy.email", label: "Performer Email" },
    { key: "performedByEmail", label: "Anonymous Email" },
    { key: "targetModel", label: "Target Model" },
    { key: "targetId", label: "Target ID" },
    { key: "targetLabel", label: "Target Label" },
    { key: "changedFields", label: "Changed Fields" },
    { key: "ipAddress", label: "IP Address" },
]

const exportCustomers = async (req, res) => {
    try {
        const { format, search, status, serviceUser, dateFrom, dateTo } = req.query
        const query = {}

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { businessName: { $regex: search, $options: "i" } },
            ]
        }
        if (status) query.status = status
        if (serviceUser) query.serviceUser = serviceUser
        if (req.user.role === "Standard") query.serviceUser = req.user.id
        const createdAt = buildDateRange(dateFrom, dateTo)
        if (createdAt) query.createdAt = createdAt

        const rows = await Customers.find(query)
            .select("-portalPassword -portalResetToken -portalResetExpires")
            .populate("serviceUser", "name email")
            .sort({ createdAt: -1 })
            .lean()

        return sendExport(res, { filename: "customers-export", format, rows, columns: customerColumns })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

const exportInvoices = async (req, res) => {
    try {
        const { format, paymentStatus, invoiceType, customer, dateFrom, dateTo } = req.query
        const query = {}
        if (paymentStatus) query.paymentStatus = paymentStatus
        if (invoiceType) query.invoiceType = invoiceType
        if (customer) query.customer = customer
        const createdAt = buildDateRange(dateFrom, dateTo)
        if (createdAt) query.createdAt = createdAt

        const rows = await Invoices.find(query)
            .populate("customer", "name phone email serviceUser")
            .populate("software", "name type")
            .populate("subscription", "billingCycle renewalDate")
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .lean()

        const visibleRows = req.user.role === "Standard"
            ? rows.filter(row => row.customer?.serviceUser?.toString() === req.user.id)
            : rows

        return sendExport(res, { filename: "invoices-export", format, rows: visibleRows, columns: invoiceColumns })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

const exportSubscriptions = async (req, res) => {
    try {
        const { format, status, paymentStatus, billingCycle, customer, dateFrom, dateTo } = req.query
        const query = {}
        if (status) query.status = status
        if (paymentStatus) query.paymentStatus = paymentStatus
        if (billingCycle) query.billingCycle = billingCycle
        if (customer) query.customer = customer
        const createdAt = buildDateRange(dateFrom, dateTo)
        if (createdAt) query.createdAt = createdAt

        const rows = await Subscriptions.find(query)
            .populate("customer", "name phone email serviceUser")
            .populate("softwares", "name type price")
            .populate("createdBy", "name email")
            .sort({ renewalDate: 1 })
            .lean()

        const visibleRows = req.user.role === "Standard"
            ? rows.filter(row => row.customer?.serviceUser?.toString() === req.user.id)
            : rows

        return sendExport(res, { filename: "subscriptions-export", format, rows: visibleRows, columns: subscriptionColumns })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

const exportAuditLogs = async (req, res) => {
    try {
        const { format, targetModel, action, performedBy, performedByEmail, category, severity, dateFrom, dateTo } = req.query
        const query = {}
        if (targetModel)       query.targetModel       = targetModel
        if (action)            query.action            = action
        if (performedBy)       query.performedBy       = performedBy
        if (performedByEmail)  query.performedByEmail  = { $regex: performedByEmail, $options: "i" }
        if (category)          query.category          = category
        if (severity)          query.severity          = severity
        const createdAt = buildDateRange(dateFrom, dateTo)
        if (createdAt) query.createdAt = createdAt

        const rows = await AuditLogs.find(query)
            .populate("performedBy", "name email role")
            .sort({ createdAt: -1 })
            .lean()

        return sendExport(res, { filename: "audit-logs-export", format, rows, columns: auditColumns })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    exportCustomers,
    exportInvoices,
    exportSubscriptions,
    exportAuditLogs,
}
