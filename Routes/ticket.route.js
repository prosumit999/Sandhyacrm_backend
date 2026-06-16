const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllTickets,
    createTicket,
    getTicketById,
    updateTicket,
    deleteTicket,
    addReply,
    assignTicket,
    resolveTicket,
    closeTicket,
    rateTicket,
} = require("../Controllers/ticket.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllTickets)
router.post("/", checkroles("SuperAdmin", "Admin", "Standard"), createTicket)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getTicketById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateTicket)
router.delete("/:id", checkroles("SuperAdmin"), deleteTicket)

router.post("/:id/reply", checkroles("SuperAdmin", "Admin", "Standard"), addReply)
router.patch("/:id/assign", checkroles("SuperAdmin", "Admin"), assignTicket)
router.patch("/:id/resolve", checkroles("SuperAdmin", "Admin"), resolveTicket)
router.patch("/:id/close", checkroles("SuperAdmin", "Admin"), closeTicket)
router.patch("/:id/rate", checkroles("SuperAdmin", "Admin", "Standard"), rateTicket)

module.exports = router
