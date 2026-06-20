const mongoose = require("mongoose")

const AuditLogSchema = mongoose.Schema(
    {
        // Who performed the action — null for anonymous events (e.g. failed login)
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
        },
        // Email used for anonymous events where no user object exists
        performedByEmail: {
            type: String,
            trim: true,
        },
        // Top-level category for UI tabs and filtering
        category: {
            type: String,
            enum: ["Action", "Security", "DataChange", "Communication", "System"],
            required: true,
            default: "Action",
        },
        action: {
            type: String,
            enum: [
                // General CRUD (Action / DataChange)
                "Created", "Updated", "Deleted", "StatusChanged",
                // Auth (Security)
                "Login", "Logout", "LoginFailed",
                "PasswordChanged", "PasswordResetRequested",
                // User management (Security)
                "UserCreated", "UserDeactivated", "UserActivated",
                "RoleChanged", "PermissionChanged",
                // Communication
                "EmailSent",
                // System config
                "ConfigChanged",
            ],
            required: true,
        },
        targetModel: {
            type: String,
            enum: [
                "Customers", "Softwares", "Subscriptions", "Invoices", "Alerts",
                "Communications", "SupportTickets", "Users", "Tags",
                "Settings", "System",
            ],
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        targetLabel: {
            type: String,
            trim: true,
        },
        changedFields: {
            type: [String],
            default: [],
        },
        // Full snapshot before the change (DataChange logs)
        before: {
            type: mongoose.Schema.Types.Mixed,
        },
        after: {
            type: mongoose.Schema.Types.Mixed,
        },
        // info = routine  |  warning = noteworthy  |  critical = security incident
        severity: {
            type: String,
            enum: ["info", "warning", "critical"],
            default: "info",
        },
        // Extra context: failure reason, email subject/recipient, config key, etc.
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
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
AuditLogSchema.index({ category: 1, createdAt: -1 })
AuditLogSchema.index({ severity: 1, createdAt: -1 })

const AuditLogs = mongoose.model("AuditLogs", AuditLogSchema)
module.exports = AuditLogs
