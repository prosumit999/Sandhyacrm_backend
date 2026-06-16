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
  enablePortalAccess,
  adminReplyPortalMessage,
  adminGetPortalMessages,
} = require("../Controllers/portal.controller")

const adminAuth = checkroles("SuperAdmin", "Admin", "Standard")

// ── Public (no auth) ──────────────────────────────────────────────────────
router.post("/auth/login",  portalLogin)
router.post("/auth/logout", portalLogout)

// ── Customer portal (portaltoken) ─────────────────────────────────────────
router.get("/auth/me",        verifyPortalCustomer, portalMe)
router.get("/dashboard",      verifyPortalCustomer, portalDashboard)
router.get("/subscriptions",  verifyPortalCustomer, portalSubscriptions)
router.get("/invoices",       verifyPortalCustomer, portalInvoices)
router.get("/alerts",         verifyPortalCustomer, portalAlerts)
router.get("/tickets",        verifyPortalCustomer, portalTickets)
router.post("/tickets",       verifyPortalCustomer, portalCreateTicket)
router.get("/tickets/:id",    verifyPortalCustomer, portalTicketDetail)
router.post("/tickets/:id/reply", verifyPortalCustomer, portalReplyTicket)
router.get("/team",           verifyPortalCustomer, portalTeam)
router.get("/messages",       verifyPortalCustomer, portalMessages)
router.post("/messages",      verifyPortalCustomer, portalSendMessage)

// ── Admin-side portal management (logintoken) ─────────────────────────────
router.patch("/admin/customers/:id/portal-access", adminAuth, enablePortalAccess)
router.get("/admin/customers/:customerId/messages", adminAuth, adminGetPortalMessages)
router.post("/admin/customers/:customerId/messages", adminAuth, adminReplyPortalMessage)

module.exports = router
