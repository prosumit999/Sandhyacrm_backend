// Extract page + limit from query, clamp limit to max 100
const getPaginationParams = (query) => {
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
    const skip = (page - 1) * limit
    return { page, limit, skip }
}

const buildPaginationMeta = (total, page, limit) => ({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
})

module.exports = { getPaginationParams, buildPaginationMeta }
