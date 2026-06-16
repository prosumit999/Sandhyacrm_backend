// Standard success response — all controllers must use these instead of raw res.json
const sendSuccess = (res, data, message = "Success", statusCode = 200, pagination = null) => {
    const body = { success: true, message, data }
    if (pagination) body.pagination = pagination
    return res.status(statusCode).json(body)
}

const sendError = (res, message = "Internal Server Error", statusCode = 500, errors = null) => {
    const body = { success: false, message }
    if (errors) body.errors = errors
    return res.status(statusCode).json(body)
}

module.exports = { sendSuccess, sendError }
