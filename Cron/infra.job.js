const Softwares = require("../Models/Softwares.schema")
const Alerts = require("../Models/Alert.Schema")
const { createAlert } = require("../Services/alert.service")
const { daysUntil } = require("../Utils/date.util")

// Check if an active/snoozed alert already exists to prevent duplicate infra alerts
const alertExists = async (softwareId, subType) => {
    const existing = await Alerts.findOne({
        software: softwareId,
        subType,
        status: { $in: ["Pending", "Snoozed"] },
    })
    return !!existing
}

// Runs daily at 9:00 AM IST — checks domain, hosting, and SSL expiry for all softwares
const runInfraJob = async () => {
    console.log("[infra.job] Starting infra expiry check...")
    let alertsCreated = 0

    try {
        const softwares = await Softwares.find(
            { status: { $nin: ["Development", "Paused"] } },
            { name: 1, liveUrl: 1, hostingProvider: 1, hostingExpiryDate: 1, domainProvider: 1, domainExpiryDate: 1, sslExpiryDate: 1 }
        ).lean()

        for (const sw of softwares) {
            // Domain expiry check
            if (sw.domainExpiryDate) {
                const days = daysUntil(sw.domainExpiryDate)
                if (days <= 30 && days >= 0 && !(await alertExists(sw._id, "DomainExpiry"))) {
                    const severity = days <= 7 ? "Urgent" : days <= 14 ? "Warning" : "Info"
                    await createAlert({
                        type: "Infra",
                        subType: "DomainExpiry",
                        title: `Domain Expiry in ${days} Days: ${sw.name}`,
                        message: `Domain for ${sw.name} (provider: ${sw.domainProvider || "unknown"}) expires in ${days} day(s). Renew immediately to prevent downtime.`,
                        severity,
                        dueDate: sw.domainExpiryDate,
                        software: sw._id,
                    })
                    alertsCreated++
                }
            }

            // Hosting expiry check
            if (sw.hostingExpiryDate) {
                const days = daysUntil(sw.hostingExpiryDate)
                if (days <= 30 && days >= 0 && !(await alertExists(sw._id, "HostingExpiry"))) {
                    const severity = days <= 7 ? "Urgent" : days <= 14 ? "Warning" : "Info"
                    await createAlert({
                        type: "Infra",
                        subType: "HostingExpiry",
                        title: `Hosting Expiry in ${days} Days: ${sw.name}`,
                        message: `Hosting for ${sw.name} (provider: ${sw.hostingProvider || "unknown"}) expires in ${days} day(s). Renew to avoid service interruption.`,
                        severity,
                        dueDate: sw.hostingExpiryDate,
                        software: sw._id,
                    })
                    alertsCreated++
                }
            }

            // SSL expiry check
            if (sw.sslExpiryDate) {
                const days = daysUntil(sw.sslExpiryDate)
                if (days <= 30 && days >= 0 && !(await alertExists(sw._id, "SSLExpiry"))) {
                    const severity = days <= 7 ? "Urgent" : days <= 14 ? "Warning" : "Info"
                    await createAlert({
                        type: "Infra",
                        subType: "SSLExpiry",
                        title: `SSL Certificate Expiry in ${days} Days: ${sw.name}`,
                        message: `SSL certificate for ${sw.name} expires in ${days} day(s). Renew certificate to prevent browser security warnings.`,
                        severity,
                        dueDate: sw.sslExpiryDate,
                        software: sw._id,
                    })
                    alertsCreated++
                }
            }
        }

        console.log(`[infra.job] Done — ${softwares.length} softwares checked, ${alertsCreated} alerts created`)
    } catch (err) {
        console.error("[infra.job] Error:", err.message)
    }
}

module.exports = runInfraJob
