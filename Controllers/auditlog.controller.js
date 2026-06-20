const AuditLogs = require("../Models/AuditLog.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

// Read-only — audit logs are never modified or deleted
const getAllAuditLogs = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { targetModel, action, performedBy, performedByEmail, category, severity, dateFrom, dateTo } = req.query
        const query = {}
        if (targetModel)       query.targetModel       = targetModel
        if (action)            query.action            = action
        if (performedBy)       query.performedBy       = performedBy
        if (performedByEmail)  query.performedByEmail  = { $regex: performedByEmail, $options: "i" }
        if (category)          query.category          = category
        if (severity)          query.severity          = severity
        if (dateFrom || dateTo) {
            query.createdAt = {}
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
            if (dateTo)   query.createdAt.$lte = new Date(dateTo)
        }

        const [logs, total] = await Promise.all([
            AuditLogs.find(query)
                .populate("performedBy", "name email role")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            AuditLogs.countDocuments(query),
        ])

        res.status(200).json({ success: true, message: "Audit logs fetched", data: logs, pagination: buildPaginationMeta(total, page, limit) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getAuditLogById = async (req, res) => {
    try {
        const log = await AuditLogs.findById(req.params.id).populate("performedBy", "name email role")
        if (!log) return res.status(404).json({ success: false, message: "Audit log not found" })
        res.status(200).json({ success: true, message: "Audit log fetched", data: log })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Summary counts for dashboard widgets
const getAuditStats = async (req, res) => {
    try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const [byCategory, bySeverity, topActions, last24h] = await Promise.all([
            AuditLogs.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
            AuditLogs.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
            AuditLogs.aggregate([
                { $group: { _id: "$action", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            AuditLogs.countDocuments({ createdAt: { $gte: since24h } }),
        ])
        res.status(200).json({ success: true, data: { byCategory, bySeverity, topActions, last24Hours: last24h } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getAllAuditLogs, getAuditLogById, getAuditStats }
