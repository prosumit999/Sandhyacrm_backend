const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllInvoices,
    createInvoice,
    getInvoiceById,
    updateInvoice,
    markInvoicePaid,
} = require("../Controllers/invoice.controller")
const { exportInvoices } = require("../Controllers/export.controller")

router.get("/", checkroles("SuperAdmin", "Admin"), getAllInvoices)
router.post("/", checkroles("SuperAdmin", "Admin"), createInvoice)
router.get("/export", checkroles("SuperAdmin", "Admin"), exportInvoices)

router.get("/:id", checkroles("SuperAdmin", "Admin"), getInvoiceById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateInvoice)

router.patch("/:id/mark-paid", checkroles("SuperAdmin", "Admin"), markInvoicePaid)

module.exports = router
