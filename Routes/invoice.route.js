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

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllInvoices)
router.post("/", checkroles("SuperAdmin", "Admin"), createInvoice)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getInvoiceById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateInvoice)

router.patch("/:id/mark-paid", checkroles("SuperAdmin", "Admin"), markInvoicePaid)

module.exports = router
