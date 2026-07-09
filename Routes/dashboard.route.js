const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const { getKPIs, getUpcomingRenewals, getInfraAlerts, getSoftwareStatus, getRecentActivity, getAlertSummary, getOperationalAlerts, getMyOverview } = require("../Controllers/dashboard.controller")

// All dashboard endpoints require at least Admin-level access
router.get("/kpis", checkroles("SuperAdmin", "Admin"), getKPIs)
router.get("/renewals", checkroles("SuperAdmin", "Admin", "Standard"), getUpcomingRenewals)
router.get("/infra-alerts", checkroles("SuperAdmin", "Admin"), getInfraAlerts)
router.get("/software-status", checkroles("SuperAdmin", "Admin"), getSoftwareStatus)
router.get("/recent-activity", checkroles("SuperAdmin", "Admin"), getRecentActivity)
router.get("/alert-summary", checkroles("SuperAdmin", "Admin"), getAlertSummary)
router.get("/operational-alerts", checkroles("SuperAdmin", "Admin"), getOperationalAlerts)
router.get("/my-overview",  checkroles("SuperAdmin", "Admin", "Standard"), getMyOverview)

module.exports = router
