const test = require("node:test")
const { assert, mockModule, clearModules } = require("./helpers")

test.afterEach(() => {
    clearModules(
        "../Cron/index",
        "../Cron/invoice.job",
        "../Cron/renewal.job",
        "../Cron/infra.job",
        "../Cron/uptime.job",
        "node-cron",
        "../Models/Invoice.Schema",
        "../Models/user.schema",
        "../Services/notification.service"
    )
})

test("startJobs schedules all cron jobs with the IST timezone", () => {
    const scheduled = []
    const jobs = {
        invoice: async () => {},
        renewal: async () => {},
        infra: async () => {},
        uptime: async () => {},
    }

    mockModule("node-cron", {
        schedule: (expression, task, options) => scheduled.push({ expression, task, options }),
    })
    mockModule("../Cron/invoice.job", jobs.invoice)
    mockModule("../Cron/renewal.job", jobs.renewal)
    mockModule("../Cron/infra.job", jobs.infra)
    mockModule("../Cron/uptime.job", jobs.uptime)

    const startJobs = require("../Cron/index")
    startJobs()

    assert.deepEqual(
        scheduled.map((item) => item.expression),
        ["0 7 * * *", "0 8 * * *", "0 9 * * *", "*/15 * * * *"]
    )
    assert.deepEqual(scheduled.map((item) => item.options.timezone), [
        "Asia/Kolkata",
        "Asia/Kolkata",
        "Asia/Kolkata",
        "Asia/Kolkata",
    ])
    assert.equal(scheduled[0].task, jobs.invoice)
    assert.equal(scheduled[2].task, jobs.infra)
})

test("invoice cron marks overdue invoices and notifies active managers", async () => {
    const notifications = []

    mockModule("../Models/Invoice.Schema", {
        updateMany: async (query, update) => {
            assert.equal(query.paymentStatus, "Pending")
            assert.ok(query.dueDate.$lt instanceof Date)
            assert.deepEqual(update, { $set: { paymentStatus: "Overdue" } })
            return { modifiedCount: 2 }
        },
    })
    mockModule("../Models/user.schema", {
        find: () => ({
            lean: async () => [{ _id: "admin-1" }, { _id: "super-1" }],
        }),
    })
    mockModule("../Services/notification.service", {
        createNotification: async (payload) => notifications.push(payload),
    })

    const runInvoiceJob = require("../Cron/invoice.job")
    await runInvoiceJob()

    assert.equal(notifications.length, 2)
    assert.equal(notifications[0].type, "PaymentOverdue")
    assert.equal(notifications[0].link, "/invoices?paymentStatus=Overdue")
})
