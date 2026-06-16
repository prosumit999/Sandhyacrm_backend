const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllSubscriptions,
    createSubscription,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    renewSubscription,
} = require("../Controllers/subscription.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllSubscriptions)
router.post("/", checkroles("SuperAdmin", "Admin"), createSubscription)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getSubscriptionById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateSubscription)
router.delete("/:id", checkroles("SuperAdmin", "Admin"), deleteSubscription)

router.post("/:id/renew", checkroles("SuperAdmin", "Admin"), renewSubscription)

module.exports = router
