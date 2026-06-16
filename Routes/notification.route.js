const express = require("express")
const router = express.Router()
const verifyJWT = require("../Middlewares/auth.middleware")
const { getMyNotifications, markNotificationRead, markAllNotificationsRead, dismissNotification } = require("../Controllers/notification.controller")

// All notification routes require the user to be logged in — verifyJWT attaches req.user
router.get("/", verifyJWT, getMyNotifications)
router.patch("/mark-all-read", verifyJWT, markAllNotificationsRead)
router.patch("/:id/read", verifyJWT, markNotificationRead)
router.patch("/:id/dismiss", verifyJWT, dismissNotification)

module.exports = router
