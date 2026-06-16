const express = require("express")
const router = express.Router()
const { login, logout, refreshToken, forgotPassword, resetPassword, getMe, register } = require("../Controllers/auth.controller")
const verifyJWT = require("../Middlewares/auth.middleware")

router.post("/login", login)
router.post("/register", register)
router.post("/logout", logout)
router.post("/refresh", refreshToken)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password/:token", resetPassword)

// getMe requires a valid access token
router.get("/me", verifyJWT, getMe)

module.exports = router
