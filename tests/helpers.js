const assert = require("node:assert/strict")

const mockModule = (request, exports) => {
    const id = require.resolve(request)
    require.cache[id] = {
        id,
        filename: id,
        loaded: true,
        exports,
    }
    return id
}

const clearModules = (...requests) => {
    for (const request of requests) {
        try {
            delete require.cache[require.resolve(request)]
        } catch (err) {
            if (err.code !== "MODULE_NOT_FOUND") throw err
        }
    }
}

const createRes = () => {
    const res = {
        statusCode: 200,
        body: undefined,
        cookies: [],
        clearedCookies: [],
        status(code) {
            this.statusCode = code
            return this
        },
        json(payload) {
            this.body = payload
            return this
        },
        cookie(name, value, options) {
            this.cookies.push({ name, value, options })
            return this
        },
        setHeader(name, value) {
            this.headers = this.headers || {}
            this.headers[name.toLowerCase()] = value
            return this
        },
        send(payload) {
            this.body = payload
            return this
        },
        clearCookie(name, options) {
            this.clearedCookies.push({ name, options })
            return this
        },
    }
    return res
}

const assertOk = (res, statusCode = 200) => {
    assert.equal(res.statusCode, statusCode)
    assert.equal(res.body.success, true)
}

module.exports = {
    assert,
    mockModule,
    clearModules,
    createRes,
    assertOk,
}
