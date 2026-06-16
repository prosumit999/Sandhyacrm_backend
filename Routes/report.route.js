const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const { getRevenueReport, getSubscriptionReport, getSoftwareReport, getCommunicationReport } = require("../Controllers/report.controller")

// Reports are SuperAdmin + Admin only
router.get("/revenue", checkroles("SuperAdmin", "Admin"), getRevenueReport)
router.get("/subscriptions", checkroles("SuperAdmin", "Admin"), getSubscriptionReport)
router.get("/softwares", checkroles("SuperAdmin", "Admin"), getSoftwareReport)
router.get("/communications", checkroles("SuperAdmin", "Admin"), getCommunicationReport)

module.exports = router
