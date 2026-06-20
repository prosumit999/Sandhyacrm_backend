const express  = require("express")
const router   = express.Router()
const verifyPortalCustomer = require("../Middlewares/portal.auth")
const checkroles = require("../Middlewares/role.permissions")
const {
  portalLogin,
  portalLogout,
  portalMe,
  portalDashboard,
  portalSubscriptions,
  portalInvoices,
  portalAlerts,
  portalTickets,
  portalCreateTicket,
  portalTicketDetail,
  portalReplyTicket,
  portalTeam,
  portalMessages,
  portalSendMessage,
  portalUnreadCount,
  enablePortalAccess,
  adminReplyPortalMessage,
  adminGetPortalMessages,
  portalForgotPassword,
  portalResetPassword,
  portalUpdateMe,
  portalChangePassword,
} = require("../Controllers/portal.controller")

const {
    getPortalNotifications,
    getPortalNotifUnreadCount,
    markPortalNotifRead,
    markAllPortalNotifsRead,
    dismissPortalNotif,
} = require("../Controllers/portalNotification.controller")

const adminAuth = checkroles("SuperAdmin", "Admin", "Standard")

// ── Public (no auth) ──────────────────────────────────────────────────────
router.post("/auth/login",                       portalLogin)
router.post("/auth/logout",                      portalLogout)
router.post("/auth/forgot-password",             portalForgotPassword)
router.post("/auth/reset-password/:token",       portalResetPassword)

// ── Customer portal (portaltoken) ─────────────────────────────────────────
router.get("/auth/me",             verifyPortalCustomer, portalMe)
router.put("/auth/me",             verifyPortalCustomer, portalUpdateMe)
router.put("/auth/change-password",verifyPortalCustomer, portalChangePassword)
router.get("/dashboard",      verifyPortalCustomer, portalDashboard)
router.get("/subscriptions",  verifyPortalCustomer, portalSubscriptions)
router.get("/invoices",       verifyPortalCustomer, portalInvoices)
router.get("/alerts",         verifyPortalCustomer, portalAlerts)
router.get("/tickets",        verifyPortalCustomer, portalTickets)
router.post("/tickets",       verifyPortalCustomer, portalCreateTicket)
router.get("/tickets/:id",    verifyPortalCustomer, portalTicketDetail)
router.post("/tickets/:id/reply", verifyPortalCustomer, portalReplyTicket)
router.get("/team",           verifyPortalCustomer, portalTeam)
router.get("/messages",         verifyPortalCustomer, portalMessages)
router.post("/messages",        verifyPortalCustomer, portalSendMessage)
router.get("/messages/unread",  verifyPortalCustomer, portalUnreadCount)

// ── Portal notifications ───────────────────────────────────────────────────
router.get("/notifications",               verifyPortalCustomer, getPortalNotifications)
router.get("/notifications/unread-count",  verifyPortalCustomer, getPortalNotifUnreadCount)
router.patch("/notifications/mark-all-read", verifyPortalCustomer, markAllPortalNotifsRead)
router.patch("/notifications/:id/read",    verifyPortalCustomer, markPortalNotifRead)
router.patch("/notifications/:id/dismiss", verifyPortalCustomer, dismissPortalNotif)

// ── Admin-side portal management (logintoken) ─────────────────────────────
router.patch("/admin/customers/:id/portal-access", adminAuth, enablePortalAccess)
router.get("/admin/customers/:customerId/messages", adminAuth, adminGetPortalMessages)
router.post("/admin/customers/:customerId/messages", adminAuth, adminReplyPortalMessage)

module.exports = router
