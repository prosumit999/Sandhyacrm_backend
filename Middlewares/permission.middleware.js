// Granular permission check — must run AFTER verifyJWT (req.user must exist)
// SuperAdmin always passes regardless of permissions array
const requirePermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required." })
        }

        // SuperAdmin bypasses all permission checks
        if (req.user.role === "SuperAdmin") return next()

        // Check if user holds at least one of the required permissions
        const userPermissions = req.user.permissions || []
        const hasPermission = permissions.some(p => userPermissions.includes(p))

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permission: ${permissions.join(" or ")}`,
            })
        }

        next()
    }
}

module.exports = requirePermission
