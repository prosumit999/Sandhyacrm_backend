const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllCommunications,
    createCommunication,
    getCommunicationById,
    deleteCommunication,
} = require("../Controllers/communication.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllCommunications)
router.post("/", checkroles("SuperAdmin", "Admin", "Standard"), createCommunication)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getCommunicationById)
router.delete("/:id", checkroles("SuperAdmin"), deleteCommunication)

module.exports = router
