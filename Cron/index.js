const cron = require("node-cron")
const runRenewalJob = require("./renewal.job")
const runInfraJob = require("./infra.job")
const runUptimeJob = require("./uptime.job")
const runInvoiceJob = require("./invoice.job")

const TIMEZONE = "Asia/Kolkata"

const startJobs = () => {
    // Invoice overdue — 7:00 AM IST daily
    cron.schedule("0 7 * * *", runInvoiceJob, { timezone: TIMEZONE })

    // Renewal reminders — 8:00 AM IST daily
    cron.schedule("0 8 * * *", runRenewalJob, { timezone: TIMEZONE })  

    // Infra expiry check (domain/hosting/SSL) — 9:00 AM IST daily
    cron.schedule("0 9 * * *", runInfraJob, { timezone: TIMEZONE })

    // Uptime monitoring — every 15 minutes
    cron.schedule("*/15 * * * *", runUptimeJob, { timezone: TIMEZONE })

    console.log("[cron] All jobs scheduled (IST timezone)")
}

module.exports = startJobs
