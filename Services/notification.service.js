const Notifications = require("../Models/Notification.schema")

// Creates an in-app notification for a single user. Silent — never throws.
const createNotification = async ({ user, type, title, message, link, linkedModel, linkedId }) => {
    try {
        await Notifications.create({ user, type, title, message, link, linkedModel, linkedId })
    } catch (_) {
        // Notification failure must never break the parent operation
    }
}

// Push the same notification to multiple users at once
const createBulkNotifications = async (userIds, payload) => {
    try {
        const docs = userIds.map((user) => ({ user, ...payload }))
        await Notifications.insertMany(docs, { ordered: false })
    } catch (_) {}
}

module.exports = { createNotification, createBulkNotifications }
