const AuditLogs = require("../Models/AuditLog.schema")

// Maps URL path segments to Mongoose collection names
const PATH_TO_MODEL = {
    customers: "Customers",
    softwares: "Softwares",
    subscriptions: "Subscriptions",
    invoices: "Invoices",
    alerts: "Alerts",
    communications: "Communications",
    tickets: "SupportTickets",
    notifications: "Notifications",
    tags: "Tags",
    users: "Users",
}

// Map HTTP methods to audit action names
const METHOD_TO_ACTION = {
    POST: "Created",
    PUT: "Updated",
    PATCH: "Updated",
    DELETE: "Deleted",
}

// Auto-log all mutating requests (POST/PUT/PATCH/DELETE) to AuditLog after response
const auditLog = (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next()
    if (!req.user) return next()

    // Intercept res.json to capture what the controller returned
    const originalJson = res.json.bind(res)
    res.json = function (body) {
        // Fire async after response is sent — audit failure must never break the response
        setImmediate(async () => {
            try {
                const segments = req.path.replace(/^\/+/, "").split("/").filter(Boolean)
                const resource = segments[0]
                const targetModel = PATH_TO_MODEL[resource]
                if (!targetModel) return

                const targetId = req.params.id || (body?.data?._id) || null
                const targetLabel = body?.data?.name || body?.data?.invoiceNumber || body?.data?.title || targetId

                const action = req.method === "PATCH"
                    ? (req.path.includes("resolve") || req.path.includes("mark-paid") || req.path.includes("close") ? "StatusChanged" : "Updated")
                    : METHOD_TO_ACTION[req.method]

                if (body?.success !== false) {
                    await AuditLogs.create({
                        performedBy: req.user.id,
                        action,
                        targetModel,
                        targetId,
                        targetLabel: String(targetLabel || ""),
                        ipAddress: req.ip || req.headers["x-forwarded-for"],
                        after: req.method === "DELETE" ? null : body?.data,
                    })
                }
            } catch (_) {
                // Silent — audit log failure must never affect business logic
            }
        })

        return originalJson(body)
    }

    next()
}

module.exports = auditLog
