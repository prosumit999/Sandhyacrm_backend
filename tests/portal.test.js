const test = require("node:test")
const { assert, mockModule, clearModules, createRes, assertOk } = require("./helpers")

const controllerPath = "../Controllers/portal.controller"

test.afterEach(() => {
    clearModules(
        controllerPath,
        "../Models/Customer.model",
        "../Models/user.schema",
        "../Models/Subscription.Schema",
        "../Models/Invoice.Schema",
        "../Models/Alert.Schema",
        "../Models/SupportTicket.schema",
        "../Models/PortalMessage.schema",
        "../Services/email.service",
        "../Services/portalNotification.service",
        "../Utils/cookie.util",
        "bcryptjs",
        "jsonwebtoken"
    )
    delete process.env.COOKIE_SECURE
    delete process.env.COOKIE_SAMESITE
})

const mockPortalDependencies = (customerModel) => {
    mockModule("../Models/Customer.model", customerModel)
    mockModule("../Models/user.schema", {})
    mockModule("../Models/Subscription.Schema", {})
    mockModule("../Models/Invoice.Schema", {})
    mockModule("../Models/Alert.Schema", {})
    mockModule("../Models/SupportTicket.schema", {})
    mockModule("../Models/PortalMessage.schema", {})
    mockModule("../Services/email.service", {
        sendPortalWelcomeEmail: async () => {},
        sendPortalResetEmail: async () => {},
    })
    mockModule("../Services/portalNotification.service", { createPortalNotification: async () => {} })
    mockModule("jsonwebtoken", { sign: () => "portal.jwt" })
}

test("portalLogin rejects customers without portal access", async () => {
    mockPortalDependencies({
        findOne: async () => ({
            _id: "cust-1",
            email: "client@example.com",
            portalAccess: false,
            portalPassword: "hash",
        }),
    })
    mockModule("bcryptjs", { compare: async () => true, genSalt: async () => "salt", hash: async () => "hash" })

    const { portalLogin } = require(controllerPath)
    const res = createRes()
    await portalLogin({ body: { email: "client@example.com", password: "secret" } }, res)

    assert.equal(res.statusCode, 403)
    assert.equal(res.body.success, false)
})

test("portalLogin sets portaltoken cookie for valid portal customer", async () => {
    const customer = {
        _id: "cust-1",
        name: "Client",
        email: "client@example.com",
        businessName: "Client Co",
        phone: "9999999999",
        portalAccess: true,
        portalPassword: "hash",
    }

    mockPortalDependencies({ findOne: async () => customer })
    mockModule("bcryptjs", { compare: async () => true, genSalt: async () => "salt", hash: async () => "hash" })

    const { portalLogin } = require(controllerPath)
    const res = createRes()
    await portalLogin({ body: { email: " Client@Example.com ", password: "secret" } }, res)

    assertOk(res)
    assert.equal(res.cookies.length, 1)
    assert.equal(res.cookies[0].name, "portaltoken")
    assert.equal(res.cookies[0].value, "portal.jwt")
    assert.equal(res.cookies[0].options.httpOnly, true)
    assert.equal(res.cookies[0].options.sameSite, "lax")
    assert.equal(res.cookies[0].options.secure, false)
    assert.equal(res.cookies[0].options.path, "/")
})

test("enablePortalAccess hashes a supplied password and excludes portalPassword from response query", async () => {
    let updatePayload
    let selectedFields
    mockPortalDependencies({
        findByIdAndUpdate: (id, update, options) => {
            assert.equal(id, "cust-1")
            assert.deepEqual(options, { new: true })
            updatePayload = update
            return {
                select: (fields) => {
                    selectedFields = fields
                    return { _id: "cust-1", portalAccess: update.portalAccess }
                },
            }
        },
    })
    mockModule("bcryptjs", {
        compare: async () => true,
        genSalt: async () => "salt",
        hash: async (password, salt) => `${salt}:${password}`,
    })

    const { enablePortalAccess } = require(controllerPath)
    const res = createRes()
    await enablePortalAccess({
        params: { id: "cust-1" },
        body: { enable: true, password: "new-password" },
    }, res)

    assertOk(res)
    assert.equal(updatePayload.portalAccess, true)
    assert.equal(updatePayload.portalPassword, "salt:new-password")
    assert.equal(selectedFields, "-portalPassword")
})
