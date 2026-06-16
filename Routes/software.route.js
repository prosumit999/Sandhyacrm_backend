const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllSoftwares,
    createSoftware,
    getSoftwareById,
    updateSoftware,
    deleteSoftware,
    getSoftwareCustomers,
} = require("../Controllers/software.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllSoftwares)
router.post("/", checkroles("SuperAdmin", "Admin"), createSoftware)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getSoftwareById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateSoftware)
router.delete("/:id", checkroles("SuperAdmin"), deleteSoftware)

router.get("/:id/customers", checkroles("SuperAdmin", "Admin", "Standard"), getSoftwareCustomers)

module.exports = router
