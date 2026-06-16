const AuditLogs = require("../Models/AuditLog.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

// Read-only — audit logs are never modified or deleted
const getAllAuditLogs = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { targetModel, action, performedBy, dateFrom, dateTo } = req.query
        const query = {}
        if (targetModel) query.targetModel = targetModel
        if (action) query.action = action
        if (performedBy) query.performedBy = performedBy
        if (dateFrom || dateTo) {
            query.createdAt = {}
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
            if (dateTo) query.createdAt.$lte = new Date(dateTo)
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

module.exports = { getAllAuditLogs, getAuditLogById }
