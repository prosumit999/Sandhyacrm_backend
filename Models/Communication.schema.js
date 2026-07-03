const mongoose = require("mongoose")

const CommunicationSchema = mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customers",
            required: true,
        },
        channel: {
            type: String,
            enum: ["SMS", "WhatsApp", "Call", "Email"],
            required: true,
        },
        direction: {
            type: String,
            enum: ["Outbound", "Inbound"],
            required: true,
        },
        // Purpose helps filter comms by type in the master log
        purpose: {
            type: String,
            enum: ["RenewalReminder", "PaymentFollowUp", "Support", "Marketing", "General"],
            default: "General",
        },
        message: {
            type: String,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        deliveryStatus: {
            type: String,
            enum: ["Sent", "Delivered", "Failed", "Pending", "Read"],
            default: "Pending",
        },
        // Optional external reference for manually logged communication records
        providerMessageId: {
            type: String,
            trim: true,
        },
        providerResponse: {
            type: String,
        },
        relatedAlert: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Alerts",
        },
        sentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
    },
    { timestamps: true }
)

CommunicationSchema.index({ customer: 1, createdAt: -1 })
CommunicationSchema.index({ channel: 1, deliveryStatus: 1 })

const Communications = mongoose.model("Communications", CommunicationSchema)
module.exports = Communications
