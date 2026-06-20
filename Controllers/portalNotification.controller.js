const PortalNotifications = require("../Models/PortalNotification.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

// GET /portal/notifications  — list for logged-in customer
const getPortalNotifications = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { isRead } = req.query

        const query = { customer: req.customer.id, isDismissed: false }
        if (isRead !== undefined) query.isRead = isRead === "true"

        const [notifications, total, unreadCount] = await Promise.all([
            PortalNotifications.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            PortalNotifications.countDocuments(query),
            PortalNotifications.countDocuments({ customer: req.customer.id, isRead: false, isDismissed: false }),
        ])

        res.status(200).json({
            success: true,
            message: "Notifications fetched",
            data: notifications,
            unreadCount,
            pagination: buildPaginationMeta(total, page, limit),
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// GET /portal/notifications/unread-count
const getPortalNotifUnreadCount = async (req, res) => {
    try {
        const count = await PortalNotifications.countDocuments({
            customer: req.customer.id,
            isRead: false,
            isDismissed: false,
        })
        res.status(200).json({ success: true, unreadCount: count })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// PATCH /portal/notifications/:id/read
const markPortalNotifRead = async (req, res) => {
    try {
        const notif = await PortalNotifications.findOneAndUpdate(
            { _id: req.params.id, customer: req.customer.id },
            { isRead: true, readAt: new Date() },
            { new: true }
        )
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found" })
        res.status(200).json({ success: true, message: "Marked as read", data: notif })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// PATCH /portal/notifications/mark-all-read
const markAllPortalNotifsRead = async (req, res) => {
    try {
        const result = await PortalNotifications.updateMany(
            { customer: req.customer.id, isRead: false, isDismissed: false },
            { isRead: true, readAt: new Date() }
        )
        res.status(200).json({ success: true, message: `${result.modifiedCount} notifications marked as read` })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// PATCH /portal/notifications/:id/dismiss
const dismissPortalNotif = async (req, res) => {
    try {
        const notif = await PortalNotifications.findOneAndUpdate(
            { _id: req.params.id, customer: req.customer.id },
            { isDismissed: true, isRead: true, readAt: new Date() },
            { new: true }
        )
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found" })
        res.status(200).json({ success: true, message: "Notification dismissed", data: notif })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getPortalNotifications,
    getPortalNotifUnreadCount,
    markPortalNotifRead,
    markAllPortalNotifsRead,
    dismissPortalNotif,
}
