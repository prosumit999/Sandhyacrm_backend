const Alerts = require("../Models/Alert.Schema")

// List alerts sorted by dueDate ascending with type, status, severity, subType filters
const getAllAlerts = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status, severity, subType } = req.query
        const query = {}
        if (type) query.type = type
        if (status) query.status = status
        if (severity) query.severity = severity
        if (subType) query.subType = subType

        const skip = (Number(page) - 1) * Number(limit)
        const [alerts, total] = await Promise.all([
            Alerts.find(query)
                .populate("customer", "name phone")
                .populate("subscription", "renewalDate billingCycle")
                .populate("software", "name")
                .populate("assignedTo", "name")
                .sort({ dueDate: 1 })
                .skip(skip)
                .limit(Number(limit)),
            Alerts.countDocuments(query),
        ])

        res.status(200).json({
            success: true,
            message: "Alerts fetched",
            data: alerts,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createAlert = async (req, res) => {
    try {
        const { type, subType, title, message, dueDate } = req.body
        if (!type || !subType || !title || !message || !dueDate) {
            return res.status(400).json({ success: false, message: "type, subType, title, message, and dueDate are required" })
        }

        const alert = new Alerts({ ...req.body, createdBy: req.user.id })
        await alert.save()

        res.status(201).json({ success: true, message: "Alert created", data: alert })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getAlertById = async (req, res) => {
    try {
        const alert = await Alerts.findById(req.params.id)
            .populate("customer", "name phone email")
            .populate("subscription", "renewalDate billingCycle amountCharged")
            .populate("software", "name type")
            .populate("assignedTo", "name email")
            .populate("createdBy", "name")

        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" })
        }
        res.status(200).json({ success: true, message: "Alert fetched", data: alert })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateAlert = async (req, res) => {
    try {
        const alert = await Alerts.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" })
        }
        res.status(200).json({ success: true, message: "Alert updated", data: alert })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Mark resolved and record who resolved it and when
const resolveAlert = async (req, res) => {
    try {
        const alert = await Alerts.findByIdAndUpdate(
            req.params.id,
            { status: "Resolved", resolvedAt: new Date(), resolvedBy: req.user.id },
            { new: true }
        )
        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" })
        }
        res.status(200).json({ success: true, message: "Alert resolved", data: alert })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const snoozeAlert = async (req, res) => {
    try {
        const { snoozedUntil } = req.body
        if (!snoozedUntil) {
            return res.status(400).json({ success: false, message: "snoozedUntil is required" })
        }

        const alert = await Alerts.findByIdAndUpdate(
            req.params.id,
            { status: "Snoozed", snoozedUntil },
            { new: true }
        )
        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" })
        }
        res.status(200).json({ success: true, message: "Alert snoozed", data: alert })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const dismissAlert = async (req, res) => {
    try {
        const alert = await Alerts.findByIdAndUpdate(req.params.id, { status: "Dismissed" }, { new: true })
        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" })
        }
        res.status(200).json({ success: true, message: "Alert dismissed", data: alert })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// SuperAdmin only — enforced at route level via checkroles
const deleteAlert = async (req, res) => {
    try {
        const alert = await Alerts.findByIdAndDelete(req.params.id)
        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" })
        }
        res.status(200).json({ success: true, message: "Alert deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllAlerts,
    createAlert,
    getAlertById,
    updateAlert,
    resolveAlert,
    snoozeAlert,
    dismissAlert,
    deleteAlert,
}
