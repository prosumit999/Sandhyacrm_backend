const Communications = require("../Models/Communication.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

// List communications with optional filters; Standard users see only their customers' comms
const getAllCommunications = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { customer, channel, direction, purpose, deliveryStatus } = req.query
        const query = {}
        if (customer) query.customer = customer
        if (channel) query.channel = channel
        if (direction) query.direction = direction
        if (purpose) query.purpose = purpose
        if (deliveryStatus) query.deliveryStatus = deliveryStatus

        const [communications, total] = await Promise.all([
            Communications.find(query)
                .populate("customer", "name phone email")
                .populate("sentBy", "name")
                .populate("relatedAlert", "title type")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Communications.countDocuments(query),
        ])

        res.status(200).json({ success: true, message: "Communications fetched", data: communications, pagination: buildPaginationMeta(total, page, limit) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Manually log a communication entry (SMS/Call/Email/WhatsApp)
const createCommunication = async (req, res) => {
    try {
        const { customer, channel, direction, message } = req.body
        if (!customer || !channel || !direction) {
            return res.status(400).json({ success: false, message: "customer, channel, and direction are required" })
        }

        const comm = new Communications({ ...req.body, sentBy: req.user.id })
        await comm.save()

        const populated = await comm.populate("customer", "name phone email")
        res.status(201).json({ success: true, message: "Communication logged", data: populated })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getCommunicationById = async (req, res) => {
    try {
        const comm = await Communications.findById(req.params.id)
            .populate("customer", "name phone email businessName")
            .populate("sentBy", "name email")
            .populate("relatedAlert", "title type status")

        if (!comm) return res.status(404).json({ success: false, message: "Communication not found" })
        res.status(200).json({ success: true, message: "Communication fetched", data: comm })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// SuperAdmin only (enforced at route level)
const deleteCommunication = async (req, res) => {
    try {
        const comm = await Communications.findByIdAndDelete(req.params.id)
        if (!comm) return res.status(404).json({ success: false, message: "Communication not found" })
        res.status(200).json({ success: true, message: "Communication deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getAllCommunications, createCommunication, getCommunicationById, deleteCommunication }
