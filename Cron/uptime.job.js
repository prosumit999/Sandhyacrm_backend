const { checkAllSoftwareUptime } = require("../Services/uptime.service")

// Runs every 15 minutes — delegates entirely to uptime.service which handles pinging + alerts
const runUptimeJob = async () => {
    console.log("[uptime.job] Running uptime check...")
    try {
        await checkAllSoftwareUptime()
        console.log("[uptime.job] Done")
    } catch (err) {
        console.error("[uptime.job] Error:", err.message)
    }
}

module.exports = runUptimeJob
