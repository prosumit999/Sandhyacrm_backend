const crypto = require("crypto")
const bcryptjs = require("bcryptjs")
const jwt = require("jsonwebtoken")
const Users = require("../Models/user.schema")
const { sendResetEmail } = require("../Services/email.service")

// Sign a short-lived access token and a long-lived refresh token, set both as httpOnly cookies
const signAndSetCookies = (res, user) => {
    const accessToken = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SEC,
        { expiresIn: "15m" }
    )
    const refreshToken = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" }
    )

    res.cookie("logintoken", accessToken, {
        httpOnly: true,
        sameSite: "Strict",
        maxAge: 15 * 60 * 1000,
    })
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return { accessToken, refreshToken }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" })
        }

        const user = await Users.findOne({ email: email.toLowerCase() })
        if (!user) {
            return res.status(404).json({ success: false, message: "No account found with this email" })
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Account is deactivated. Contact your administrator" })
        }

        const isMatch = await bcryptjs.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" })
        }

        await Users.findByIdAndUpdate(user._id, { lastlogin: new Date() })
        signAndSetCookies(res, user)

        res.status(200).json({
            success: true,
            message: "Login successful",
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const logout = async (req, res) => {
    try {
        res.clearCookie("logintoken", { httpOnly: true, sameSite: "Strict" })
        res.clearCookie("refreshToken", { httpOnly: true, sameSite: "Strict" })
        res.status(200).json({ success: true, message: "Logged out successfully" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Verify refresh token cookie and issue a new access token
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken
        if (!token) {
            return res.status(401).json({ success: false, message: "Refresh token not found, please login again" })
        }

        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)
        const user = await Users.findById(decoded.id)
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: "Invalid session, please login again" })
        }

        const newAccessToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SEC,
            { expiresIn: "15m" }
        )
        res.cookie("logintoken", newAccessToken, {
            httpOnly: true,
            sameSite: "Strict",
            maxAge: 15 * 60 * 1000,
        })

        res.status(200).json({ success: true, message: "Token refreshed" })
    } catch (err) {
        res.clearCookie("logintoken")
        res.clearCookie("refreshToken")
        res.status(401).json({ success: false, message: "Session expired, please login again" })
    }
}

// Generate a hashed reset token, save to user with 10-min expiry
// NOTE: when email.service.js is built, replace the token in response with an emailed link
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" })
        }

        const user = await Users.findOne({ email: email.toLowerCase() })
        if (!user) {
            // Respond with same message to prevent email enumeration
            return res.status(200).json({ success: true, message: "If this email exists, a reset link has been sent" })
        }

        const rawToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")

        user.passwordResetToken = hashedToken
        user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000)
        await user.save()

        // Send reset link via email (resolves GOTCHA-009 — no longer in response body)
        try {
            await sendResetEmail(user.email, rawToken)
        } catch (emailErr) {
            // If email fails in dev (SMTP not configured), fall back to response body
            if (process.env.NODE_ENV !== "production") {
                return res.status(200).json({ success: true, message: "Email unavailable in dev — use this token", resetToken: rawToken })
            }
            throw emailErr
        }

        res.status(200).json({ success: true, message: "If this email exists, a reset link has been sent" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Validate reset token, hash new password, clear token fields, auto-login
const resetPassword = async (req, res) => {
    try {
        const { password } = req.body
        if (!password) {
            return res.status(400).json({ success: false, message: "New password is required" })
        }

        const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

        const user = await Users.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() },
        })
        if (!user) {
            return res.status(400).json({ success: false, message: "Reset token is invalid or has expired" })
        }

        const salt = await bcryptjs.genSalt(10)
        user.password = await bcryptjs.hash(password, salt)
        user.passwordResetToken = undefined
        user.passwordResetExpires = undefined
        await user.save()

        signAndSetCookies(res, user)

        res.status(200).json({ success: true, message: "Password reset successful" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Public self-registration — always creates a Standard role account
const register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: "Name, email, phone and password are required" })
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" })
        }

        const existing = await Users.findOne({ email: email.toLowerCase() })
        if (existing) {
            return res.status(409).json({ success: false, message: "An account with this email already exists" })
        }

        const salt = await bcryptjs.genSalt(10)
        const hashedPassword = await bcryptjs.hash(password, salt)

        const user = await Users.create({
            name,
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            role: "Standard",
        })

        res.status(201).json({
            success: true,
            message: "Account created successfully. You can now sign in.",
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Return the currently logged-in user's profile (req.user set by auth.middleware)
const getMe = async (req, res) => {
    try {
        const user = await Users.findById(req.user.id).select("-password -passwordResetToken -passwordResetExpires")
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }
        res.status(200).json({ success: true, message: "Profile fetched", data: user })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { login, logout, refreshToken, forgotPassword, resetPassword, getMe, register }
