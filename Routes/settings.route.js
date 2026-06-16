const express = require("express")
const router  = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const { getInvoiceSettings, updateInvoiceSettings } = require("../Controllers/settings.controller")

// All logged-in roles can read (needed for PDF generation)
router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getInvoiceSettings)

// Only Admin+ can write
router.put("/", checkroles("SuperAdmin", "Admin"), updateInvoiceSettings)

module.exports = router
