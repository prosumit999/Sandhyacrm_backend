const test = require("node:test")
const { assert, mockModule, clearModules, createRes, assertOk } = require("./helpers")

const controllerPath = "../Controllers/subscription.controller"

test.afterEach(() => {
    clearModules(
        controllerPath,
        "../Models/Subscription.Schema",
        "../Models/Invoice.Schema",
        "../Models/Customer.model",
        "../Models/Softwares.schema",
        "../Utils/invoiceNumber.util",
        "../Services/email.service",
        "../Services/auditlog.service"
    )
})

test("createSubscription creates the subscription and an initial invoice", async () => {
    process.env.EMAIL_SEND_SUBSCRIPTION = "false"

    const savedSubscriptions = []
    const savedInvoices = []

    function Subscription(doc) {
        Object.assign(this, doc)
        this._id = "sub-1"
        this.save = async () => savedSubscriptions.push({ ...this })
    }
    function Invoice(doc) {
        Object.assign(this, doc)
        this.save = async () => savedInvoices.push({ ...this })
    }

    mockModule("../Models/Subscription.Schema", Subscription)
    mockModule("../Models/Invoice.Schema", Invoice)
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Softwares.schema", {})
    mockModule("../Utils/invoiceNumber.util", { generateInvoiceNumber: async () => "INV-2026-000002" })
    mockModule("../Services/email.service", { sendSubscriptionCreatedEmail: async () => {} })
    mockModule("../Services/auditlog.service", { logEmailSent: async () => {} })

    const { createSubscription } = require(controllerPath)
    const res = createRes()
    await createSubscription({
        body: {
            customer: "cust-1",
            softwares: "soft-1",
            renewalDate: "2027-06-01",
            amountCharged: 5000,
            paymentStatus: "Pending",
        },
        user: { id: "admin-1", role: "Admin" },
    }, res)

    assertOk(res, 201)
    assert.equal(savedSubscriptions.length, 1)
    assert.equal(savedInvoices.length, 1)
    assert.equal(savedInvoices[0].invoiceType, "NewPurchase")
    assert.equal(savedInvoices[0].invoiceNumber, "INV-2026-000002")
    assert.equal(savedInvoices[0].createdBy, "admin-1")
})

test("renewSubscription resets reminder flags and creates a renewal invoice", async () => {
    const savedInvoices = []
    const subscription = {
        _id: "sub-1",
        customer: "cust-1",
        softwares: "soft-1",
        amountCharged: 3000,
        reminderSent: { thirtyDays: true, sevenDays: true, oneDay: true, overdue: true },
        save: async function save() {
            this.saved = true
        },
    }

    function Subscription() {}
    Subscription.findById = async () => subscription

    function Invoice(doc) {
        Object.assign(this, doc)
        this.save = async () => savedInvoices.push({ ...this })
    }

    mockModule("../Models/Subscription.Schema", Subscription)
    mockModule("../Models/Invoice.Schema", Invoice)
    mockModule("../Models/Customer.model", {})
    mockModule("../Models/Softwares.schema", {})
    mockModule("../Utils/invoiceNumber.util", { generateInvoiceNumber: async () => "INV-2026-000003" })
    mockModule("../Services/email.service", { sendSubscriptionCreatedEmail: async () => {} })
    mockModule("../Services/auditlog.service", { logEmailSent: async () => {} })

    const { renewSubscription } = require(controllerPath)
    const res = createRes()
    await renewSubscription({
        params: { id: "sub-1" },
        body: { renewalDate: "2028-06-01", amountCharged: 4500 },
        user: { id: "admin-1" },
    }, res)

    assertOk(res)
    assert.equal(subscription.status, "Active")
    assert.deepEqual(subscription.reminderSent, { thirtyDays: false, sevenDays: false, oneDay: false, overdue: false })
    assert.equal(savedInvoices[0].invoiceType, "Renewal")
    assert.equal(savedInvoices[0].paymentStatus, "Paid")
})
