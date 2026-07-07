const mongoose = require("mongoose")

// Subdocument for each reply in the ticket thread
const ReplySchema = mongoose.Schema(
    {
        message:         { type: String, required: true, trim: true },
        sentBy:          { type: mongoose.Schema.Types.ObjectId, ref: "Users" },   // null when customer replies
        isCustomerReply: { type: Boolean, default: false },
        customerRef:     { type: mongoose.Schema.Types.ObjectId, ref: "Customers" }, // set when isCustomerReply
        isInternal:      { type: Boolean, default: false },
        attachments:     { type: [String], default: [] },
    },
    { timestamps: true }
)

const SupportTicketSchema = mongoose.Schema(
    {
        ticketNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,  // e.g. "TKT-2025-0042"
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customers",
            required: true,
        },
        software: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Softwares",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["Bug", "FeatureRequest", "HowTo", "Performance", "Billing", "Other"],
            required: true,
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
        },
        description: {
            type: String,
            trim: true,
        },
        attachments: {
            type: [String],
            default: [],
        },
        status: {
            type: String,
            enum: ["Open", "InProgress", "WaitingOnClient", "Resolved", "Closed"],
            default: "Open",
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        // SLA fields
        dueBy: {
            type: Date,
        },
        resolvedAt: {
            type: Date,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
        },
        resolutionSummary: {
            type: String,
            trim: true,
        },
        closedAt: {
            type: Date,
        },
        // Customer satisfaction rating after ticket is closed
        customerRating: {
            type: Number,
            min: 1,
            max: 5,
        },
        tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tags" }],
        replies: [ReplySchema],
    },
    { timestamps: true }
)

SupportTicketSchema.index({ customer: 1, status: 1 })
SupportTicketSchema.index({ software: 1, status: 1 })
SupportTicketSchema.index({ assignedTo: 1, status: 1 })

const SupportTickets = mongoose.model("SupportTickets", SupportTicketSchema)
module.exports = SupportTickets
