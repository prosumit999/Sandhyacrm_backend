const getBooleanEnv = (name, fallback) => {
    const value = process.env[name]
    if (value === undefined) return fallback
    return value === "true"
}

const getSameSite = () => {
    const value = (process.env.COOKIE_SAMESITE || "lax").toLowerCase()
    return ["strict", "lax", "none"].includes(value) ? value : "lax"
}

const getCookieBaseOptions = () => {
    const secure = getBooleanEnv("COOKIE_SECURE", process.env.NODE_ENV === "production")
    const sameSite = getSameSite()

    return {
        httpOnly: true,
        secure: sameSite === "none" ? true : secure,
        sameSite,
        path: "/",
    }
}

const authCookieOptions = (maxAge) => ({
    ...getCookieBaseOptions(),
    maxAge,
})

const clearCookieOptions = () => getCookieBaseOptions()

module.exports = {
    authCookieOptions,
    clearCookieOptions,
}
