const mongoose = require("mongoose")

// Append-only log — no update or delete allowed (enforced in controller)
const AuditLogSchema = mongoose.Schema(
    {
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        action: {
            type: String,
            enum: ["Created", "Updated", "Deleted", "StatusChanged", "Login", "Logout", "PermissionChanged"],
            required: true,
        },
        targetModel: {
            type: String,
            enum: ["Customers", "Softwares", "Subscriptions", "Invoices", "Alerts", "Communications", "SupportTickets", "Users", "Tags"],
            required: true,
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        // Human-readable label so the log is readable without joins
        targetLabel: {
            type: String,
            trim: true,
        },
        // Fields that changed (array of field names)
        changedFields: {
            type: [String],
            default: [],
        },
        // Full document snapshot before the change
        before: {
            type: mongoose.Schema.Types.Mixed,
        },
        // Full document snapshot after the change
        after: {
            type: mongoose.Schema.Types.Mixed,
        },
        ipAddress: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
)

AuditLogSchema.index({ performedBy: 1, createdAt: -1 })
AuditLogSchema.index({ targetModel: 1, targetId: 1 })

const AuditLogs = mongoose.model("AuditLogs", AuditLogSchema)
module.exports = AuditLogs
