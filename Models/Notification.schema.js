const mongoose = require("mongoose")

const NotificationSchema = mongoose.Schema(
    {
        // Notification belongs to a specific user (their bell)
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        type: {
            type: String,
            enum: [
                "SubscriptionRenewal",
                "PaymentOverdue",
                "DomainExpiry",
                "HostingExpiry",
                "SSLExpiry",
                "TicketAssigned",
                "TicketReplied",
                "TicketResolved",
                "InvoiceCreated",
                "AlertTriggered",
                "Custom",
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        // Frontend uses this to navigate to the linked record on click
        link: {
            type: String,
            trim: true,
        },
        linkedModel: {
            type: String,
            enum: ["Customers", "Softwares", "Subscriptions", "Invoices", "Alerts", "SupportTickets"],
        },
        linkedId: {
            type: mongoose.Schema.Types.ObjectId,
        },
    },
    { timestamps: true }
)

NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })

const Notifications = mongoose.model("Notifications", NotificationSchema)
module.exports = Notifications
