const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const { getAllAuditLogs, getAuditLogById, getAuditStats, getTargetTimeline } = require("../Controllers/auditlog.controller")
const { exportAuditLogs } = require("../Controllers/export.controller")

// Audit log is read-only — SuperAdmin and Admin only
router.get("/stats", checkroles("SuperAdmin", "Admin"), getAuditStats)
router.get("/timeline", checkroles("SuperAdmin", "Admin"), getTargetTimeline)
router.get("/export", checkroles("SuperAdmin", "Admin"), exportAuditLogs)
router.get("/",      checkroles("SuperAdmin", "Admin"), getAllAuditLogs)
router.get("/:id",   checkroles("SuperAdmin", "Admin"), getAuditLogById)

module.exports = router
