const mongoose = require("mongoose")

const PortalNotificationSchema = mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customers",
            required: true,
        },
        type: {
            type: String,
            enum: ["InvoiceCreated", "TicketReplied", "TicketResolved", "AlertCreated", "RenewalReminder", "Custom"],
            required: true,
        },
        title:   { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        isRead:      { type: Boolean, default: false },
        readAt:      { type: Date },
        isDismissed: { type: Boolean, default: false },
        // Portal route the customer is taken to on click (e.g. /portal/tickets/abc)
        link: { type: String, trim: true },
    },
    { timestamps: true }
)

PortalNotificationSchema.index({ customer: 1, isRead: 1, createdAt: -1 })

module.exports = mongoose.model("PortalNotifications", PortalNotificationSchema)
