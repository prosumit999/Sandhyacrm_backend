const AuditLogs = require("../Models/AuditLog.schema")

const SENSITIVE = new Set([
    "password", "passwordResetToken", "passwordResetExpires",
    "portalPassword", "portalResetToken",
])

const sanitize = (obj) => {
    if (!obj || typeof obj !== "object") return obj
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !SENSITIVE.has(k)))
}

// Shallow field diff — returns array of field names whose values differ
const computeChangedFields = (before, after) => {
    if (!before || !after) return []
    const SKIP = new Set(["_id", "__v", "createdAt", "updatedAt", ...SENSITIVE])
    const normalize = (v) => {
        if (v && typeof v === "object" && v._id) return String(v._id)
        if (v instanceof Date) return v.toISOString()
        return v
    }
    const changed = []
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (SKIP.has(key)) continue
        if (JSON.stringify(normalize(before[key])) !== JSON.stringify(normalize(after[key]))) {
            changed.push(key)
        }
    }
    return changed
}

// Silent helper — AuditLog failure must NEVER propagate to the calling request
const writeAuditLog = async ({
    performedBy, performedByEmail,
    category = "Action", action,
    targetModel, targetId, targetLabel,
    changedFields, before, after,
    severity = "info", metadata,
    ipAddress,
}) => {
    try {
        await AuditLogs.create({
            performedBy:      performedBy      || undefined,
            performedByEmail: performedByEmail || undefined,
            category,
            action,
            targetModel:   targetModel || undefined,
            targetId:      targetId   || undefined,
            targetLabel:   targetLabel ? String(targetLabel) : undefined,
            changedFields: changedFields || [],
            before: before ? sanitize(before) : undefined,
            after:  after  ? sanitize(after)  : undefined,
            severity,
            metadata: metadata || {},
            ipAddress,
        })
    } catch (_) {
        // Intentionally silent — audit failure must never break business logic
    }
}

// Convenience wrapper for Communication logs — always fire-and-forget
const logEmailSent = (performedBy, { to, subject, type, targetId, targetModel, targetLabel, ipAddress }) => {
    writeAuditLog({
        performedBy,
        category:    "Communication",
        action:      "EmailSent",
        targetId,
        targetModel: targetModel || "Customers",
        targetLabel: targetLabel || to,
        severity:    "info",
        metadata:    { to, subject, type },
        ipAddress,
    }).catch(() => {})
}

module.exports = { writeAuditLog, logEmailSent, computeChangedFields }
