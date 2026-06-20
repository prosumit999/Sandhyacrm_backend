const PortalNotifications = require("../Models/PortalNotification.schema")

const createPortalNotification = async ({ customer, type, title, message, link }) => {
    try {
        await PortalNotifications.create({ customer, type, title, message, link })
    } catch (_) {
        // Fire-and-forget — never let notification failures break business logic
    }
}

module.exports = { createPortalNotification }
