const test = require("node:test")
const { assert, mockModule, clearModules, createRes, assertOk } = require("./helpers")

const controllerPath = "../Controllers/auth.controller"

test.afterEach(() => {
    clearModules(
        controllerPath,
        "../Models/user.schema",
        "bcryptjs",
        "jsonwebtoken",
        "../Services/email.service",
        "../Services/auditlog.service",
        "../Utils/cookie.util"
    )
    delete process.env.COOKIE_SECURE
    delete process.env.COOKIE_SAMESITE
    delete process.env.ALLOW_PUBLIC_REGISTRATION
})

test("auth login sets httpOnly access and refresh cookies for a valid active user", async () => {
    process.env.JWT_SEC = "test-access-secret"
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret"

    const user = {
        _id: "user-1",
        name: "Admin User",
        email: "admin@example.com",
        role: "Admin",
        isActive: true,
        password: "hashed",
    }

    mockModule("../Models/user.schema", {
        findOne: async (query) => {
            assert.deepEqual(query, { email: "admin@example.com" })
            return user
        },
        findByIdAndUpdate: async (id, update) => {
            assert.equal(id, user._id)
            assert.ok(update.lastlogin instanceof Date)
        },
    })
    mockModule("bcryptjs", { compare: async () => true })
    mockModule("jsonwebtoken", {
        sign: (payload, secret, options) => `${secret}:${payload.id}:${options.expiresIn}`,
    })
    mockModule("../Services/email.service", { sendResetEmail: async () => {} })
    mockModule("../Services/auditlog.service", {
        writeAuditLog: async () => {},
        logEmailSent: async () => {},
    })

    const { login } = require(controllerPath)
    const res = createRes()
    await login({ body: { email: "Admin@Example.com", password: "secret" }, ip: "127.0.0.1", headers: {} }, res)

    assertOk(res)
    assert.equal(res.body.user.email, user.email)
    assert.equal(res.cookies.length, 2)
    assert.equal(res.cookies[0].name, "logintoken")
    assert.equal(res.cookies[0].options.httpOnly, true)
    assert.equal(res.cookies[0].options.sameSite, "lax")
    assert.equal(res.cookies[0].options.secure, false)
    assert.equal(res.cookies[0].options.path, "/")
    assert.equal(res.cookies[1].name, "refreshToken")
    assert.equal(res.cookies[1].options.httpOnly, true)
    assert.equal(res.cookies[1].options.sameSite, "lax")
    assert.equal(res.cookies[1].options.secure, false)
})

test("auth cookies use secure mode when configured for production", async () => {
    process.env.JWT_SEC = "test-access-secret"
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret"
    process.env.COOKIE_SECURE = "true"
    process.env.COOKIE_SAMESITE = "strict"

    mockModule("../Models/user.schema", {
        findOne: async () => ({
            _id: "user-1",
            name: "Admin User",
            email: "admin@example.com",
            role: "Admin",
            isActive: true,
            password: "hashed",
        }),
        findByIdAndUpdate: async () => {},
    })
    mockModule("bcryptjs", { compare: async () => true })
    mockModule("jsonwebtoken", { sign: () => "token" })
    mockModule("../Services/email.service", { sendResetEmail: async () => {} })
    mockModule("../Services/auditlog.service", {
        writeAuditLog: async () => {},
        logEmailSent: async () => {},
    })

    const { login } = require(controllerPath)
    const res = createRes()
    await login({ body: { email: "admin@example.com", password: "secret" }, ip: "127.0.0.1", headers: {} }, res)

    assertOk(res)
    assert.equal(res.cookies[0].options.secure, true)
    assert.equal(res.cookies[0].options.sameSite, "strict")
})

test("auth login rejects missing credentials before querying users", async () => {
    let queried = false
    mockModule("../Models/user.schema", { findOne: async () => { queried = true } })
    mockModule("bcryptjs", { compare: async () => false })
    mockModule("jsonwebtoken", { sign: () => "token" })
    mockModule("../Services/email.service", { sendResetEmail: async () => {} })
    mockModule("../Services/auditlog.service", {
        writeAuditLog: async () => {},
        logEmailSent: async () => {},
    })

    const { login } = require(controllerPath)
    const res = createRes()
    await login({ body: { email: "" }, headers: {} }, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.success, false)
    assert.equal(queried, false)
})

test("auth register is disabled unless explicitly enabled", async () => {
    let queried = false
    mockModule("../Models/user.schema", {
        findOne: async () => { queried = true },
    })
    mockModule("bcryptjs", { genSalt: async () => "salt", hash: async () => "hash" })
    mockModule("jsonwebtoken", { sign: () => "token" })
    mockModule("../Services/email.service", { sendResetEmail: async () => {} })
    mockModule("../Services/auditlog.service", {
        writeAuditLog: async () => {},
        logEmailSent: async () => {},
    })

    const { register } = require(controllerPath)
    const res = createRes()
    await register({
        body: { name: "New User", email: "new@example.com", phone: "9999999999", password: "password123" },
        ip: "127.0.0.1",
    }, res)

    assert.equal(res.statusCode, 403)
    assert.equal(res.body.success, false)
    assert.equal(queried, false)
})
