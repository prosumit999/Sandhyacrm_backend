const test = require("node:test")
const { assert, mockModule, clearModules, createRes, assertOk } = require("./helpers")

const controllerPath = "../Controllers/invoice.controller"

test.afterEach(() => {
    clearModules(
        controllerPath,
        "../Models/Invoice.Schema",
        "../Models/Customer.model",
        "../Models/Softwares.schema",
        "../Utils/invoiceNumber.util",
        "../Services/email.service",
        "../Services/auditlog.service",
        "../Services/portalNotification.service"
    )
})

test("createInvoice validates required billing fields", async () => {
    mockModule("../Models/Invoice.Schema", function Invoice() {})
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Softwares.schema", {})
    mockModule("../Utils/invoiceNumber.util", { generateInvoiceNumber: async () => "INV-2026-000001" })
    mockModule("../Services/email.service", {})
    mockModule("../Services/auditlog.service", { logEmailSent: async () => {} })
    mockModule("../Services/portalNotification.service", { createPortalNotification: async () => {} })

    const { createInvoice } = require(controllerPath)
    const res = createRes()
    await createInvoice({ body: { customer: "cust-1" }, user: { id: "user-1", role: "Admin" } }, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.success, false)
})

test("createInvoice generates an invoice number, saves invoice, and creates portal notification", async () => {
    process.env.EMAIL_SEND_INVOICE = "false"

    const savedInvoices = []
    const notifications = []
    function Invoice(doc) {
        Object.assign(this, doc)
        this.save = async () => {
            savedInvoices.push({ ...this })
        }
    }

    mockModule("../Models/Invoice.Schema", Invoice)
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Softwares.schema", {})
    mockModule("../Utils/invoiceNumber.util", { generateInvoiceNumber: async () => "INV-2026-000001" })
    mockModule("../Services/email.service", { sendDetailedInvoiceEmail: async () => {} })
    mockModule("../Services/auditlog.service", { logEmailSent: async () => {} })
    mockModule("../Services/portalNotification.service", {
        createPortalNotification: (payload) => notifications.push(payload),
    })

    const { createInvoice } = require(controllerPath)
    const res = createRes()
    await createInvoice({
        body: {
            customer: "cust-1",
            subscription: "sub-1",
            software: "soft-1",
            amount: 1000,
            totalAmount: 1180,
            periodFrom: "2026-06-01",
            periodTo: "2027-06-01",
        },
        user: { id: "admin-1", role: "Admin" },
        ip: "127.0.0.1",
    }, res)

    assertOk(res, 201)
    assert.equal(savedInvoices[0].invoiceNumber, "INV-2026-000001")
    assert.equal(savedInvoices[0].createdBy, "admin-1")
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].customer, "cust-1")
    assert.equal(notifications[0].type, "InvoiceCreated")
})

test("markInvoicePaid requires a payment method", async () => {
    mockModule("../Models/Invoice.Schema", {})
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Softwares.schema", {})
    mockModule("../Utils/invoiceNumber.util", { generateInvoiceNumber: async () => "INV-2026-000001" })
    mockModule("../Services/email.service", { sendPaymentConfirmationEmail: async () => {} })
    mockModule("../Services/auditlog.service", { logEmailSent: async () => {} })
    mockModule("../Services/portalNotification.service", { createPortalNotification: async () => {} })

    const { markInvoicePaid } = require(controllerPath)
    const res = createRes()
    await markInvoicePaid({ body: {}, params: { id: "inv-1" }, user: { id: "admin-1" } }, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.success, false)
})
