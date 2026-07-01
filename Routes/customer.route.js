const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    getCustomerSubscriptions,
    getCustomerInvoices,
} = require("../Controllers/customer.controller")
const { exportCustomers } = require("../Controllers/export.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllCustomers)
router.post("/", checkroles("SuperAdmin", "Admin", "Standard"), createCustomer)
router.get("/export", checkroles("SuperAdmin", "Admin", "Standard"), exportCustomers)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getCustomerById)
router.put("/:id", checkroles("SuperAdmin", "Admin", "Standard"), updateCustomer)
router.delete("/:id", checkroles("SuperAdmin"), deleteCustomer)

router.get("/:id/subscriptions", checkroles("SuperAdmin", "Admin", "Standard"), getCustomerSubscriptions)
router.get("/:id/invoices", checkroles("SuperAdmin", "Admin", "Standard"), getCustomerInvoices)

module.exports = router
