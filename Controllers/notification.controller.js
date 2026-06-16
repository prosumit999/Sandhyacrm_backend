const Notifications = require("../Models/Notification.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

// Fetch only the logged-in user's notifications
const getMyNotifications = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { isRead } = req.query
        const query = { user: req.user.id }
        if (isRead !== undefined) query.isRead = isRead === "true"

        const [notifications, total, unreadCount] = await Promise.all([
            Notifications.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notifications.countDocuments(query),
            Notifications.countDocuments({ user: req.user.id, isRead: false }),
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

const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notifications.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isRead: true, readAt: new Date() },
            { new: true }
        )
        if (!notification) return res.status(404).json({ success: false, message: "Notification not found" })
        res.status(200).json({ success: true, message: "Marked as read", data: notification })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Mark all unread notifications as read for the current user
const markAllNotificationsRead = async (req, res) => {
    try {
        const result = await Notifications.updateMany(
            { user: req.user.id, isRead: false },
            { isRead: true, readAt: new Date() }
        )
        res.status(200).json({ success: true, message: `${result.modifiedCount} notifications marked as read` })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const dismissNotification = async (req, res) => {
    try {
        const notification = await Notifications.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isDismissed: true },
            { new: true }
        )
        if (!notification) return res.status(404).json({ success: false, message: "Notification not found" })
        res.status(200).json({ success: true, message: "Notification dismissed", data: notification })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getMyNotifications, markNotificationRead, markAllNotificationsRead, dismissNotification }
