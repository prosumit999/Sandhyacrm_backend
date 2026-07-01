const toPlain = (value) => {
    if (!value) return value
    if (typeof value.toObject === "function") return value.toObject()
    return value
}

const getByPath = (source, path) => {
    const value = path.split(".").reduce((obj, key) => (obj == null ? undefined : obj[key]), source)
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(item => {
        const plain = toPlain(item)
        if (plain && typeof plain === "object") return plain.name || plain.email || plain._id || JSON.stringify(plain)
        return plain
    }).join("; ")
    if (value && typeof value === "object") return value.name || value.email || value._id || JSON.stringify(value)
    return value ?? ""
}

const escapeCsv = (value) => {
    const text = String(value ?? "")
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
}

const toCsv = (rows, columns) => {
    const header = columns.map(column => escapeCsv(column.label)).join(",")
    const body = rows.map(row => {
        const plain = toPlain(row)
        return columns.map(column => escapeCsv(getByPath(plain, column.key))).join(",")
    })
    return [header, ...body].join("\n")
}

const sendExport = (res, { filename, format, rows, columns }) => {
    const normalizedFormat = format === "json" ? "json" : "csv"
    const exportedAt = new Date().toISOString()

    if (normalizedFormat === "json") {
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`)
        return res.status(200).json({
            success: true,
            exportedAt,
            count: rows.length,
            data: rows.map(toPlain),
        })
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`)
    return res.status(200).send(toCsv(rows, columns))
}

const buildDateRange = (dateFrom, dateTo) => {
    if (!dateFrom && !dateTo) return undefined
    const range = {}
    if (dateFrom) range.$gte = new Date(dateFrom)
    if (dateTo) range.$lte = new Date(dateTo)
    return range
}

module.exports = {
    buildDateRange,
    sendExport,
}
