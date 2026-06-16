const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    updateUserPermissions,
    getPortfolioStats,
    getUserPortfolio,
    transferPortfolio,
    loginUser,
    logOut,
} = require("../Controllers/user.controller")

// Auth endpoints (no role check — handled inside controller or by auth.middleware)
router.post("/login", loginUser)
router.get("/logout", logOut)

// User management
router.get("/", checkroles("SuperAdmin", "Admin"), getAllUsers)
router.post("/", checkroles("SuperAdmin"), createUser)

// Static sub-routes must come before /:id to avoid param capture
router.get("/portfolio-stats", checkroles("SuperAdmin", "Admin"), getPortfolioStats)

router.get("/:id", checkroles("SuperAdmin", "Admin"), getUserById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateUser)
router.delete("/:id", checkroles("SuperAdmin"), deleteUser)

router.patch("/:id/toggle-active", checkroles("SuperAdmin"), toggleUserActive)
router.patch("/:id/permissions", checkroles("SuperAdmin"), updateUserPermissions)
router.get("/:id/portfolio", checkroles("SuperAdmin", "Admin"), getUserPortfolio)
router.post("/:id/transfer-portfolio", checkroles("SuperAdmin"), transferPortfolio)

module.exports = router
