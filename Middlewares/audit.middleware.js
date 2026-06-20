const { writeAuditLog, computeChangedFields } = require("../Services/auditlog.service")

// Maps URL path segments to collection names
const PATH_TO_MODEL = {
    customers:      "Customers",
    softwares:      "Softwares",
    subscriptions:  "Subscriptions",
    invoices:       "Invoices",
    alerts:         "Alerts",
    communications: "Communications",
    tickets:        "SupportTickets",
    tags:           "Tags",
    users:          "Users",
}

// Lazy model loader — only the models we can safely pre-fetch for before-snapshots
const MODEL_FILES = {
    customers:     "../Models/Customer.model",
    softwares:     "../Models/Softwares.schema",
    subscriptions: "../Models/Subscription.Schema",
    invoices:      "../Models/Invoice.Schema",
    alerts:        "../Models/Alert.Schema",
    users:         "../Models/user.schema",
}
const getModel = (resource) => {
    const file = MODEL_FILES[resource]
    if (!file) return null
    try { return require(file) } catch (_) { return null }
}

const METHOD_TO_ACTION = { POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted" }
const MONGO_ID = /^[a-f\d]{24}$/i

// Auto-log all mutating requests (POST/PUT/PATCH/DELETE) to AuditLog after response.
// For updates and deletes, pre-fetches the document so we can record before/after and changedFields.
const auditLog = (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next()
    if (!req.user) return next()

    const segments = req.path.replace(/^\/+/, "").split("/").filter(Boolean)
    const resource = segments[0]
    const targetModel = PATH_TO_MODEL[resource]
    if (!targetModel) return next()

    // Derive the document ID from the path (e.g. /customers/abc123)
    const pathId = segments[1] && MONGO_ID.test(segments[1]) ? segments[1] : null

    // Start pre-fetching before-snapshot immediately (runs in parallel with route handler)
    let beforePromise = Promise.resolve(null)
    if (["PUT", "PATCH", "DELETE"].includes(req.method) && pathId) {
        const Model = getModel(resource)
        if (Model) beforePromise = Model.findById(pathId).lean().catch(() => null)
    }

    const originalJson = res.json.bind(res)
    res.json = function (body) {
        setImmediate(async () => {
            try {
                if (body?.success === false) return

                const beforeDoc = await beforePromise
                const afterDoc  = req.method === "DELETE" ? null : body?.data

                const action = req.method === "PATCH"
                    ? (req.path.includes("resolve") || req.path.includes("mark-paid") ||
                       req.path.includes("close")   || req.path.includes("toggle")
                       ? "StatusChanged" : "Updated")
                    : METHOD_TO_ACTION[req.method]

                const changed = (action === "Updated" || action === "StatusChanged")
                    ? computeChangedFields(beforeDoc, afterDoc)
                    : []

                // DataChange = an update that actually modified something; Action = create/delete/status
                const category = (action === "Updated" && changed.length > 0) ? "DataChange" : "Action"

                const targetId   = pathId || body?.data?._id || null
                const targetLabel = body?.data?.name || body?.data?.invoiceNumber
                    || body?.data?.title || body?.data?.email || targetId

                await writeAuditLog({
                    performedBy:  req.user.id,
                    category,
                    action,
                    targetModel,
                    targetId,
                    targetLabel:   String(targetLabel || ""),
                    changedFields: changed,
                    before: category === "DataChange" ? beforeDoc : undefined,
                    after:  afterDoc,
                    ipAddress: req.ip || req.headers["x-forwarded-for"],
                })
            } catch (_) {}
        })

        return originalJson(body)
    }

    next()
}

module.exports = auditLog
