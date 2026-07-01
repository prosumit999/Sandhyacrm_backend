const Users = require("../Models/user.schema")
const bcryptjs = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")
const { writeAuditLog } = require("../Services/auditlog.service")
const { authCookieOptions, clearCookieOptions } = require("../Utils/cookie.util")

const getAllUsers = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { role, isActive, search, department } = req.query
        const query = {}
        if (role) query.role = role
        if (isActive !== undefined) query.isActive = isActive === "true"
        if (department) query.department = department
        if (search) query.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ]

        const [users, total] = await Promise.all([
            Users.find(query)
                .select("-password -passwordResetToken -passwordResetExpires")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Users.countDocuments(query),
        ])

        res.status(200).json({ success: true, message: "Users fetched", data: users, pagination: buildPaginationMeta(total, page, limit) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getUserById = async (req, res) => {
    try {
        const user = await Users.findById(req.params.id).select("-password -passwordResetToken -passwordResetExpires")
        if (!user) return res.status(404).json({ success: false, message: "User not found" })
        res.status(200).json({ success: true, message: "User fetched", data: user })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createUser = async (req, res) => {
    try {
        const { name, email, password, phone, role, department } = req.body
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: "name, email, password, and phone are required" })
        }

        const salt = await bcryptjs.genSalt(10)
        const hashedPassword = await bcryptjs.hash(password, salt)
        const user = new Users({ name, email, password: hashedPassword, phone, role, department })
        await user.save()

        writeAuditLog({ category: "Security", action: "UserCreated", performedBy: req.user.id, targetModel: "Users", targetId: user._id, targetLabel: user.email, severity: "info", metadata: { role: role || "Standard", createdByRole: req.user.role }, ipAddress: req.ip }).catch(() => {})

        const { password: _, ...userData } = user.toObject()
        res.status(201).json({ success: true, message: `${name} created successfully`, data: userData })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: "Email already in use" })
        res.status(500).json({ success: false, message: err.message })
    }
}

// Update profile fields — role change is only allowed for SuperAdmin (enforced at route level)
const updateUser = async (req, res) => {
    try {
        const { password, passwordResetToken, passwordResetExpires, ...safeFields } = req.body
        // Capture old role before update if role is being changed
        const oldUser = safeFields.role
            ? await Users.findById(req.params.id).select("email role").lean()
            : null
        const user = await Users.findByIdAndUpdate(req.params.id, safeFields, { new: true, runValidators: true })
            .select("-password -passwordResetToken -passwordResetExpires")
        if (!user) return res.status(404).json({ success: false, message: "User not found" })
        if (oldUser && safeFields.role && oldUser.role !== safeFields.role) {
            writeAuditLog({ category: "Security", action: "RoleChanged", performedBy: req.user.id, targetModel: "Users", targetId: user._id, targetLabel: user.email, severity: "warning", metadata: { oldRole: oldUser.role, newRole: safeFields.role, changedByRole: req.user.role }, ipAddress: req.ip }).catch(() => {})
        }
        res.status(200).json({ success: true, message: "User updated", data: user })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: "Email already in use" })
        res.status(500).json({ success: false, message: err.message })
    }
}

// Soft delete — users are never hard deleted; isActive=false blocks login via auth.middleware
const deleteUser = async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot deactivate your own account" })
        }
        const user = await Users.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
            .select("-password -passwordResetToken -passwordResetExpires")
        if (!user) return res.status(404).json({ success: false, message: "User not found" })
        writeAuditLog({ category: "Security", action: "UserDeactivated", performedBy: req.user.id, targetModel: "Users", targetId: user._id, targetLabel: user.email, severity: "warning", metadata: { deactivatedByRole: req.user.role }, ipAddress: req.ip }).catch(() => {})
        res.status(200).json({ success: true, message: "User deactivated", data: user })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Toggle isActive on/off without full delete
const toggleUserActive = async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot toggle your own active status" })
        }
        const user = await Users.findById(req.params.id)
        if (!user) return res.status(404).json({ success: false, message: "User not found" })

        user.isActive = !user.isActive
        await user.save()
        writeAuditLog({ category: "Security", action: user.isActive ? "UserActivated" : "UserDeactivated", performedBy: req.user.id, targetModel: "Users", targetId: user._id, targetLabel: user.email, severity: user.isActive ? "info" : "warning", metadata: { changedByRole: req.user.role }, ipAddress: req.ip }).catch(() => {})
        res.status(200).json({ success: true, message: `User ${user.isActive ? "activated" : "deactivated"}`, data: { id: user._id, isActive: user.isActive } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Set granular permissions array — SuperAdmin always bypasses this so no point setting it for them
const updateUserPermissions = async (req, res) => {
    try {
        const { permissions } = req.body
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: "permissions must be an array" })
        }

        const user = await Users.findById(req.params.id)
        if (!user) return res.status(404).json({ success: false, message: "User not found" })
        if (user.role === "SuperAdmin") {
            return res.status(400).json({ success: false, message: "SuperAdmin has all permissions — no need to set them" })
        }

        user.permissions = permissions
        await user.save()
        writeAuditLog({ category: "Security", action: "PermissionChanged", performedBy: req.user.id, targetModel: "Users", targetId: user._id, targetLabel: user.email, severity: "warning", metadata: { permissions, changedByRole: req.user.role }, ipAddress: req.ip }).catch(() => {})
        res.status(200).json({ success: true, message: "Permissions updated", data: { id: user._id, role: user.role, permissions: user.permissions } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Aggregate customer counts for all users in one query
const getPortfolioStats = async (req, res) => {
    try {
        const Customers = require("../Models/Customer.model")
        const stats = await Customers.aggregate([
            {
                $group: {
                    _id: "$serviceUser",
                    customerCount: { $sum: 1 },
                    referralCount: {
                        $sum: { $cond: [{ $ne: [{ $ifNull: ["$referrredBy", ""] }, ""] }, 1, 0] }
                    },
                }
            }
        ])
        res.status(200).json({ success: true, data: stats })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Full customer list for a specific user
const getUserPortfolio = async (req, res) => {
    try {
        const Customers = require("../Models/Customer.model")
        const customers = await Customers.find({ serviceUser: req.params.id })
            .select("name email phone businessName status referrredBy createdAt")
            .sort({ createdAt: -1 })
        const referralCount = customers.filter(c => c.referrredBy?.trim()).length
        res.status(200).json({
            success: true,
            data: { customers, customerCount: customers.length, referralCount },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Bulk reassign all customers from one user to another
const transferPortfolio = async (req, res) => {
    try {
        const { toUserId } = req.body
        if (!toUserId) return res.status(400).json({ success: false, message: "toUserId is required" })
        if (req.params.id === toUserId) return res.status(400).json({ success: false, message: "Cannot transfer to the same user" })

        const targetUser = await Users.findById(toUserId)
        if (!targetUser || !targetUser.isActive) {
            return res.status(404).json({ success: false, message: "Target user not found or inactive" })
        }

        const Customers = require("../Models/Customer.model")
        const result = await Customers.updateMany(
            { serviceUser: req.params.id },
            { $set: { serviceUser: toUserId } }
        )
        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} customers transferred to ${targetUser.name}`,
            data: { transferred: result.modifiedCount, toUser: { id: targetUser._id, name: targetUser.name } },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "email and password are required" })
        }

        const user = await Users.findOne({ email })
        if (!user) return res.status(404).json({ success: false, message: "No account found with this email" })
        if (!user.isActive) return res.status(401).json({ success: false, message: "Account is deactivated" })

        const match = await bcryptjs.compare(password, user.password)
        if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" })

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SEC, { expiresIn: "2d" })

        res.cookie("logintoken", token, authCookieOptions(2 * 24 * 60 * 60 * 1000))

        user.lastLogin = new Date()
        await user.save()

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: { id: user._id, name: user.name, email: user.email, role: user.role },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const logOut = async (req, res) => {
    try {
        res.clearCookie("logintoken", clearCookieOptions())
        res.status(200).json({ success: true, message: "Logged out successfully" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
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
}
