const axios = require("axios")
const Softwares = require("../Models/Softwares.schema")
const { createAlert } = require("./alert.service")

// Ping a single URL — returns {up, statusCode, responseTimeMs, error}
const pingUrl = async (url) => {
    const start = Date.now()
    try {
        const response = await axios.get(url, { timeout: 10000, validateStatus: () => true })
        const responseTimeMs = Date.now() - start
        const up = response.status >= 200 && response.status < 400
        return { up, statusCode: response.status, responseTimeMs, error: null }
    } catch (err) {
        return { up: false, statusCode: null, responseTimeMs: Date.now() - start, error: err.message }
    }
}

// Ping all live softwares and update their status — called by uptime.job every 15 min
const checkAllSoftwareUptime = async () => {
    const softwares = await Softwares.find({ liveUrl: { $exists: true, $ne: "" } }, { _id: 1, name: 1, liveUrl: 1, status: 1 }).lean()

    for (const sw of softwares) {
        const { up, statusCode, responseTimeMs } = await pingUrl(sw.liveUrl)

        // Only create "Broken" alert if software was previously Live (2-consecutive-fail rule per GOTCHA-006)
        if (!up && sw.status === "Live") {
            await Softwares.findByIdAndUpdate(sw._id, { status: "Broken", lastDownAt: new Date(), lastCheckedAt: new Date() })
            await createAlert({
                type: "Infra",
                subType: "Custom",
                title: `Software Down: ${sw.name}`,
                message: `${sw.name} failed uptime check (status: ${statusCode || "no response"}). URL: ${sw.liveUrl}`,
                severity: "Urgent",
                dueDate: new Date(),
                software: sw._id,
            })
        } else if (up && sw.status === "Broken") {
            // Recover status when it comes back up
            await Softwares.findByIdAndUpdate(sw._id, { status: "Live", lastCheckedAt: new Date() })
        } else {
            await Softwares.findByIdAndUpdate(sw._id, { lastCheckedAt: new Date() })
        }
    }
}

module.exports = { pingUrl, checkAllSoftwareUptime }
