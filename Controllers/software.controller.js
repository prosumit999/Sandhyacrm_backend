const Softwares = require("../Models/Softwares.schema")
const Subscriptions = require("../Models/Subscription.Schema")

// List softwares with type, status, builtFor, developer filters and pagination
const getAllSoftwares = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status, builtFor, developer } = req.query
        const query = {}
        if (type) query.type = type
        if (status) query.status = status
        if (builtFor) query.builtFor = builtFor
        if (developer) query.developer = developer

        const skip = (Number(page) - 1) * Number(limit)
        const [softwares, total] = await Promise.all([
            Softwares.find(query)
                .populate("developer", "name email")
                .populate("managedBy", "name email")
                .populate("team", "name color")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Softwares.countDocuments(query),
        ])

        res.status(200).json({
            success: true,
            message: "Softwares fetched",
            data: softwares,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createSoftware = async (req, res) => {
    try {
        const { name, type, price, developer } = req.body
        if (!name || !type || !price || !developer) {
            return res.status(400).json({ success: false, message: "name, type, price, and developer are required" })
        }

        const software = new Softwares(req.body)
        await software.save()

        res.status(201).json({ success: true, message: "Software created", data: software })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getSoftwareById = async (req, res) => {
    try {
        const software = await Softwares.findById(req.params.id)
            .populate("developer", "name email")
            .populate("managedBy", "name email")

        if (!software) {
            return res.status(404).json({ success: false, message: "Software not found" })
        }
        res.status(200).json({ success: true, message: "Software fetched", data: software })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateSoftware = async (req, res) => {
    try {
        const software = await Softwares.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        if (!software) {
            return res.status(404).json({ success: false, message: "Software not found" })
        }
        res.status(200).json({ success: true, message: "Software updated", data: software })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Plan rule: cannot delete software that has active subscriptions
const deleteSoftware = async (req, res) => {
    try {
        const activeCount = await Subscriptions.countDocuments({ softwares: req.params.id, status: "Active" })
        if (activeCount > 0) {
            return res.status(400).json({ success: false, message: "Cannot delete software with active subscriptions" })
        }

        const software = await Softwares.findByIdAndDelete(req.params.id)
        if (!software) {
            return res.status(404).json({ success: false, message: "Software not found" })
        }
        res.status(200).json({ success: true, message: "Software deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Customers with an active subscription to this software
const getSoftwareCustomers = async (req, res) => {
    try {
        const subscriptions = await Subscriptions.find({ softwares: req.params.id, status: "Active" })
            .populate("customer", "name phone email businessName")
            .sort({ renewalDate: 1 })

        const data = subscriptions.map(s => ({
            ...s.customer.toObject(),
            renewalDate: s.renewalDate,
            paymentStatus: s.paymentStatus,
        }))

        res.status(200).json({ success: true, message: "Customers fetched", data })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllSoftwares,
    createSoftware,
    getSoftwareById,
    updateSoftware,
    deleteSoftware,
    getSoftwareCustomers,
}
