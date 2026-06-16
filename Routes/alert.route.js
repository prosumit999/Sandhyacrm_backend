const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllAlerts,
    createAlert,
    getAlertById,
    updateAlert,
    resolveAlert,
    snoozeAlert,
    dismissAlert,
    deleteAlert,
} = require("../Controllers/alert.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllAlerts)
router.post("/", checkroles("SuperAdmin", "Admin"), createAlert)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getAlertById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateAlert)
router.delete("/:id", checkroles("SuperAdmin"), deleteAlert)

router.patch("/:id/resolve", checkroles("SuperAdmin", "Admin"), resolveAlert)
router.patch("/:id/snooze", checkroles("SuperAdmin", "Admin", "Standard"), snoozeAlert)
router.patch("/:id/dismiss", checkroles("SuperAdmin", "Admin", "Standard"), dismissAlert)

module.exports = router
