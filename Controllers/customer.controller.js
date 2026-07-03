const Customers = require("../Models/Customer.model")
const Subscriptions = require("../Models/Subscription.Schema")
const Invoices = require("../Models/Invoice.Schema")
const { sendCustomerWelcomeEmail, sendStaffNewCustomerEmail } = require("../Services/email.service")
const { logEmailSent } = require("../Services/auditlog.service")

const ensureAssignedCustomerAccess = async (req, res) => {
    if (req.user.role !== "Standard") return true

    const customer = await Customers.findById(req.params.id).select("serviceUser")
    if (!customer) {
        res.status(404).json({ success: false, message: "Customer not found" })
        return false
    }
    if (customer.serviceUser?.toString() !== req.user.id) {
        res.status(403).json({ success: false, message: "Access denied" })
        return false
    }
    return true
}

// List customers with search, status filter, and pagination; Standard users see only their assigned
const getAllCustomers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status, serviceUser } = req.query
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

        const skip = (Number(page) - 1) * Number(limit)
        const [customers, total] = await Promise.all([
            Customers.find(query)
                .select("-portalPassword")
                .populate("serviceUser", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Customers.countDocuments(query),
        ])

        res.status(200).json({
            success: true,
            message: "Customers fetched",
            data: customers,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createCustomer = async (req, res) => {
    try {
        const { name, email, phone, serviceUser } = req.body
        if (!name || !email || !phone || !serviceUser) {
            return res.status(400).json({ success: false, message: "name, email, phone, and serviceUser are required" })
        }

        const customer = new Customers(req.body)
        await customer.save()

        // Emails only for SuperAdmin / Admin actions — Standard users never trigger emails
        if (req.user.role !== "Standard" && process.env.EMAIL_SEND_WELCOME === "true") {
            Customers.findById(customer._id)
                .populate("serviceUser", "name email")
                .then(populated => {
                    if (!populated) return
                    const d = {
                        customerName:     populated.name,
                        customerEmail:    populated.email,
                        phone:            populated.phone,
                        whatsapp:         populated.whatsapp,
                        businessName:     populated.businessName,
                        subscriptionType: populated.Subscriptions,
                        city:             populated.address?.city,
                        state:            populated.address?.state,
                        notes:            populated.notes,
                        createdByName:    req.user.name || req.user.email,
                    }
                    const sv = populated.serviceUser

                    // Welcome email to the customer
                    sendCustomerWelcomeEmail(populated.email, { ...d, assignedStaffName: sv?.name })
                        .then(() => logEmailSent(req.user.id, { to: populated.email, subject: "Customer Welcome", type: "CustomerWelcome", targetId: populated._id, targetModel: "Customers", targetLabel: populated.name, ipAddress: req.ip }))
                        .catch(() => {})

                    // Internal notification to assigned staff
                    const notified = new Set()
                    if (sv?.email) {
                        notified.add(sv.email)
                        sendStaffNewCustomerEmail(sv.email, { staffName: sv.name, ...d })
                            .then(() => logEmailSent(req.user.id, { to: sv.email, subject: "New Customer Assigned", type: "StaffNewCustomer", targetId: populated._id, targetModel: "Customers", targetLabel: populated.name, ipAddress: req.ip }))
                            .catch(() => {})
                    }
                    // Also notify creator if different from assigned staff
                    if (req.user.email && !notified.has(req.user.email)) {
                        sendStaffNewCustomerEmail(req.user.email, { staffName: req.user.name || "Admin", ...d })
                            .then(() => logEmailSent(req.user.id, { to: req.user.email, subject: "New Customer Created", type: "StaffNewCustomer", targetId: populated._id, targetModel: "Customers", targetLabel: populated.name, ipAddress: req.ip }))
                            .catch(() => {})
                    }
                })
                .catch(() => {})
        }

        res.status(201).json({ success: true, message: "Customer created", data: customer })
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: "Email already exists" })
        }
        res.status(500).json({ success: false, message: err.message })
    }
}

// Standard users can only view customers assigned to them
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customers.findById(req.params.id)
            .select("-portalPassword")
            .populate("serviceUser", "name email phone")

        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" })
        }
        if (req.user.role === "Standard" && customer.serviceUser._id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied" })
        }

        res.status(200).json({ success: true, message: "Customer fetched", data: customer })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateCustomer = async (req, res) => {
    try {
        const customer = await Customers.findById(req.params.id)
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" })
        }
        if (req.user.role === "Standard" && customer.serviceUser.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Access denied" })
        }

        const updated = await Customers.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        res.status(200).json({ success: true, message: "Customer updated", data: updated })
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: "Email already exists" })
        }
        res.status(500).json({ success: false, message: err.message })
    }
}

// SuperAdmin only — enforced at route level via checkroles
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customers.findByIdAndDelete(req.params.id)
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" })
        }
        res.status(200).json({ success: true, message: "Customer deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getCustomerSubscriptions = async (req, res) => {
    try {
        const allowed = await ensureAssignedCustomerAccess(req, res)
        if (!allowed) return

        const subscriptions = await Subscriptions.find({ customer: req.params.id })
            .populate("softwares", "name type price")
            .sort({ renewalDate: 1 })

        res.status(200).json({ success: true, message: "Subscriptions fetched", data: subscriptions })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getCustomerInvoices = async (req, res) => {
    try {
        const allowed = await ensureAssignedCustomerAccess(req, res)
        if (!allowed) return

        const invoices = await Invoices.find({ customer: req.params.id })
            .populate("software", "name")
            .sort({ createdAt: -1 })

        res.status(200).json({ success: true, message: "Invoices fetched", data: invoices })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    getCustomerSubscriptions,
    getCustomerInvoices,
}
