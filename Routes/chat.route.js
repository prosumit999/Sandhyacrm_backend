const express = require("express")
const router  = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
  getChatUsers,
  getConversations,
  getAllConversations,
  createConversation,
  getMessages,
  searchShareInvoices,
  searchShareSubscriptions,
  searchShareAlerts,
} = require("../Controllers/chat.controller")

const auth      = checkroles("SuperAdmin", "Admin", "Standard")
const adminOnly = checkroles("SuperAdmin", "Admin")

router.get("/admin/conversations",             adminOnly, getAllConversations)
router.get("/users",                           auth, getChatUsers)
router.get("/conversations",                   auth, getConversations)
router.post("/conversations",                  auth, createConversation)
router.get("/conversations/:id/messages",      auth, getMessages)
router.get("/share/invoices",                  auth, searchShareInvoices)
router.get("/share/subscriptions",             auth, searchShareSubscriptions)
router.get("/share/alerts",                    auth, searchShareAlerts)

module.exports = router
