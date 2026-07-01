const test = require("node:test")
const { assert, mockModule, clearModules, createRes, assertOk } = require("./helpers")

const controllerPath = "../Controllers/export.controller"

const chain = (rows, capture = {}) => ({
    select(fields) {
        capture.select = fields
        return this
    },
    populate(path, fields) {
        capture.populate = capture.populate || []
        capture.populate.push({ path, fields })
        return this
    },
    sort(sort) {
        capture.sort = sort
        return this
    },
    lean: async () => rows,
})

test.afterEach(() => {
    clearModules(
        controllerPath,
        "../Models/Customer.model",
        "../Models/Invoice.Schema",
        "../Models/Subscription.Schema",
        "../Models/AuditLog.schema",
        "../Utils/export.util"
    )
})

test("exportCustomers returns CSV with filters and safe headers", async () => {
    let querySeen
    mockModule("../Models/Customer.model", {
        find: (query) => {
            querySeen = query
            return chain([
                {
                    _id: "cust-1",
                    name: "Asha",
                    businessName: "Asha Co",
                    email: "asha@example.com",
                    phone: "999",
                    status: "Active",
                    Subscriptions: "Web Application",
                    serviceUser: { name: "Manager" },
                    address: { city: "Pune", state: "MH", country: "India" },
                    createdAt: new Date("2026-06-01T00:00:00.000Z"),
                },
            ])
        },
    })
    mockModule("../Models/Invoice.Schema", {})
    mockModule("../Models/Subscription.Schema", {})
    mockModule("../Models/AuditLog.schema", {})

    const { exportCustomers } = require(controllerPath)
    const res = createRes()
    await exportCustomers({
        query: { format: "csv", status: "Active", search: "asha" },
        user: { id: "admin-1", role: "Admin" },
    }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.headers["content-type"], "text/csv; charset=utf-8")
    assert.match(res.headers["content-disposition"], /customers-export\.csv/)
    assert.match(res.body, /Customer ID,Name,Business Name/)
    assert.match(res.body, /cust-1,Asha,Asha Co/)
    assert.equal(querySeen.status, "Active")
    assert.ok(querySeen.$or)
})

test("exportCustomers restricts Standard users to assigned customers", async () => {
    let querySeen
    mockModule("../Models/Customer.model", {
        find: (query) => {
            querySeen = query
            return chain([])
        },
    })
    mockModule("../Models/Invoice.Schema", {})
    mockModule("../Models/Subscription.Schema", {})
    mockModule("../Models/AuditLog.schema", {})

    const { exportCustomers } = require(controllerPath)
    const res = createRes()
    await exportCustomers({
        query: { serviceUser: "someone-else" },
        user: { id: "standard-1", role: "Standard" },
    }, res)

    assert.equal(res.statusCode, 200)
    assert.equal(querySeen.serviceUser, "standard-1")
})

test("exportInvoices returns JSON and filters rows for Standard users", async () => {
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Invoice.Schema", {
        find: () => chain([
            { _id: "inv-1", invoiceNumber: "INV-1", customer: { name: "Mine", serviceUser: "standard-1" } },
            { _id: "inv-2", invoiceNumber: "INV-2", customer: { name: "Other", serviceUser: "standard-2" } },
        ]),
    })
    mockModule("../Models/Subscription.Schema", {})
    mockModule("../Models/AuditLog.schema", {})

    const { exportInvoices } = require(controllerPath)
    const res = createRes()
    await exportInvoices({
        query: { format: "json" },
        user: { id: "standard-1", role: "Standard" },
    }, res)

    assertOk(res)
    assert.equal(res.headers["content-type"], "application/json; charset=utf-8")
    assert.equal(res.body.count, 1)
    assert.equal(res.body.data[0].invoiceNumber, "INV-1")
})

test("exportAuditLogs returns JSON export metadata and records", async () => {
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Invoice.Schema", {})
    mockModule("../Models/Subscription.Schema", {})
    mockModule("../Models/AuditLog.schema", {
        find: () => chain([
            { _id: "audit-1", category: "Security", action: "Login", severity: "info" },
        ]),
    })

    const { exportAuditLogs } = require(controllerPath)
    const res = createRes()
    await exportAuditLogs({
        query: { format: "json", category: "Security" },
        user: { id: "admin-1", role: "Admin" },
    }, res)

    assertOk(res)
    assert.equal(res.body.count, 1)
    assert.equal(res.body.data[0].action, "Login")
    assert.match(res.headers["content-disposition"], /audit-logs-export\.json/)
})
