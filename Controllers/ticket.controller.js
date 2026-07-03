const SupportTickets = require("../Models/SupportTicket.schema")
const { generateTicketNumber } = require("../Utils/invoiceNumber.util")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")
const { createPortalNotification } = require("../Services/portalNotification.service")

const normalizeArray = (value) => Array.isArray(value) ? value : value ? [value] : []

const getAllTickets = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { status, priority, type, assignedTo, customer, software } = req.query
        const query = {}
        if (status) query.status = status
        if (priority) query.priority = priority
        if (type) query.type = type
        if (assignedTo) query.assignedTo = assignedTo
        if (customer) query.customer = customer
        if (software) query.software = software

        const [tickets, total] = await Promise.all([
            SupportTickets.find(query)
                .populate("customer", "name phone email")
                .populate("software", "name type")
                .populate("assignedTo", "name email")
                .populate("createdBy", "name")
                .select("-replies")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            SupportTickets.countDocuments(query),
        ])

        res.status(200).json({ success: true, message: "Tickets fetched", data: tickets, pagination: buildPaginationMeta(total, page, limit) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createTicket = async (req, res) => {
    try {
        const { customer, software, title, type } = req.body
        if (!customer || !software || !title || !type) {
            return res.status(400).json({ success: false, message: "customer, software, title, and type are required" })
        }

        const ticketNumber = await generateTicketNumber()
        const ticket = new SupportTickets({
            ...req.body,
            attachments: normalizeArray(req.body.attachments),
            ticketNumber,
            createdBy: req.user.id,
            dueBy: new Date(Date.now() + 10 * 60 * 1000),
        })
        await ticket.save()

        const populated = await ticket.populate([
            { path: "customer", select: "name phone email" },
            { path: "software", select: "name type" },
        ])
        res.status(201).json({ success: true, message: "Ticket created", data: populated })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getTicketById = async (req, res) => {
    try {
        const ticket = await SupportTickets.findById(req.params.id)
            .populate("customer", "name phone email businessName")
            .populate("software", "name type liveUrl")
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("replies.sentBy", "name role")

        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
        res.status(200).json({ success: true, message: "Ticket fetched", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateTicket = async (req, res) => {
    try {
        const { replies, ticketNumber, createdBy, resolvedAt, closedAt, ...safeFields } = req.body
        const ticket = await SupportTickets.findByIdAndUpdate(req.params.id, safeFields, { new: true, runValidators: true })
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
        res.status(200).json({ success: true, message: "Ticket updated", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const deleteTicket = async (req, res) => {
    try {
        const ticket = await SupportTickets.findByIdAndDelete(req.params.id)
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
        res.status(200).json({ success: true, message: "Ticket deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const addReply = async (req, res) => {
    try {
        const { message, isInternal = false } = req.body
        if (!message) return res.status(400).json({ success: false, message: "message is required" })

        const attachments = normalizeArray(req.body.attachments)

        const ticket = await SupportTickets.findByIdAndUpdate(
            req.params.id,
            { $push: { replies: { message, sentBy: req.user.id, isInternal, attachments } } },
            { new: true }
        ).populate("replies.sentBy", "name role")

        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })

        if (!ticket.firstResponseAt) {
            await SupportTickets.findByIdAndUpdate(req.params.id, { firstResponseAt: new Date() })
        }

        if (!isInternal && ticket.customer) {
            createPortalNotification({
                customer: ticket.customer,
                type:    "TicketReplied",
                title:   "New reply on your ticket",
                message: `Your support ticket #${ticket.ticketNumber} has received a reply from our team.`,
                link:    `/portal/tickets/${ticket._id}`,
            })
        }

        res.status(200).json({ success: true, message: "Reply added", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const assignTicket = async (req, res) => {
    try {
        const { assignedTo } = req.body
        if (!assignedTo) return res.status(400).json({ success: false, message: "assignedTo (userId) is required" })

        const ticket = await SupportTickets.findByIdAndUpdate(
            req.params.id,
            { assignedTo, status: "InProgress" },
            { new: true }
        ).populate("assignedTo", "name email")

        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
        res.status(200).json({ success: true, message: "Ticket assigned", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const resolveTicket = async (req, res) => {
    try {
        const { resolutionSummary } = req.body
        const ticket = await SupportTickets.findByIdAndUpdate(
            req.params.id,
            { status: "Resolved", resolvedAt: new Date(), resolvedBy: req.user.id, resolutionSummary },
            { new: true }
        )
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })

        if (ticket.customer) {
            createPortalNotification({
                customer: ticket.customer,
                type:    "TicketResolved",
                title:   "Your ticket has been resolved",
                message: `Support ticket #${ticket.ticketNumber} has been marked as resolved. We hope your issue is fixed!`,
                link:    `/portal/tickets/${ticket._id}`,
            })
        }

        res.status(200).json({ success: true, message: "Ticket resolved", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const closeTicket = async (req, res) => {
    try {
        const ticket = await SupportTickets.findByIdAndUpdate(
            req.params.id,
            { status: "Closed", closedAt: new Date() },
            { new: true }
        )
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
        res.status(200).json({ success: true, message: "Ticket closed", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const rateTicket = async (req, res) => {
    try {
        const { customerRating } = req.body
        if (!customerRating || customerRating < 1 || customerRating > 5) {
            return res.status(400).json({ success: false, message: "customerRating must be between 1 and 5" })
        }

        const ticket = await SupportTickets.findById(req.params.id)
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
        if (!["Resolved", "Closed"].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: "Can only rate Resolved or Closed tickets" })
        }

        ticket.customerRating = customerRating
        await ticket.save()
        res.status(200).json({ success: true, message: "Rating submitted", data: ticket })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllTickets,
    createTicket,
    getTicketById,
    updateTicket,
    deleteTicket,
    addReply,
    assignTicket,
    resolveTicket,
    closeTicket,
    rateTicket,
}
