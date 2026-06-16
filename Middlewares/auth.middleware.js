const jwt = require("jsonwebtoken")
const Users = require("../Models/user.schema")

// Reads access token from logintoken cookie, verifies it, and attaches req.user
const verifyJWT = async (req, res, next) => {
    try {
        const token = req.cookies.logintoken
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication required. Please login." })
        }

        const decoded = jwt.verify(token, process.env.JWT_SEC)

        // Fetch fresh user to ensure account is still active and role hasn't changed
        const user = await Users.findById(decoded.id).select("-password -passwordResetToken -passwordResetExpires")
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false,
                 message: "Account not found or deactivated."
                 })
        }

        req.user = { id: user._id.toString(), name: user.name, email: user.email, role: user.role }
        next()
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token. Please login again." })
    }
}

module.exports = verifyJWT
