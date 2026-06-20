const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const { getAllAuditLogs, getAuditLogById, getAuditStats } = require("../Controllers/auditlog.controller")

// Audit log is read-only — SuperAdmin and Admin only
router.get("/stats", checkroles("SuperAdmin", "Admin"), getAuditStats)
router.get("/",      checkroles("SuperAdmin", "Admin"), getAllAuditLogs)
router.get("/:id",   checkroles("SuperAdmin", "Admin"), getAuditLogById)

module.exports = router
