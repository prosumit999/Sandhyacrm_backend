const AuditLogs = require("../Models/AuditLog.schema")

// Silent helper — AuditLog failure must NEVER propagate to the calling request
const writeAuditLog = async ({ performedBy, action, targetModel, targetId, targetLabel, changedFields, before, after, ipAddress }) => {
    try {
        // Strip sensitive fields before persisting (GOTCHA-003)
        const sanitize = (obj) => {
            if (!obj) return obj
            const { password, passwordResetToken, passwordResetExpires, ...clean } = obj
            return clean
        }

        await AuditLogs.create({
            performedBy,
            action,
            targetModel,
            targetId,
            targetLabel: String(targetLabel || ""),
            changedFields: changedFields || [],
            before: before ? sanitize(before) : undefined,
            after: after ? sanitize(after) : undefined,
            ipAddress,
        })
    } catch (_) {
        // Intentionally silent — audit failure must never break business logic
    }
}

module.exports = { writeAuditLog }
