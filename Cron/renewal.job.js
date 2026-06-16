const Subscriptions = require("../Models/Subscription.Schema")
const { createAlert } = require("../Services/alert.service")
const { daysUntil } = require("../Utils/date.util")

// Runs daily at 8:00 AM IST — checks all Active subscriptions for upcoming/overdue renewals
const runRenewalJob = async () => {
    console.log("[renewal.job] Starting renewal check...")
    let processed = 0
    let alertsCreated = 0

    try {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() + 31)

        // Fetch only subscriptions that could trigger a reminder
        const subscriptions = await Subscriptions.find({
            status: "Active",
            renewalDate: { $lte: cutoff },
        })
            .populate("customer", "name phone email")
            .populate("softwares", "name")
            .lean()

        for (const sub of subscriptions) {
            const days = daysUntil(sub.renewalDate)
            const customerName = sub.customer?.name || "Unknown"
            const softwareName = sub.softwares?.name || "Unknown"
            const label = `${customerName} — ${softwareName}`
            const updates = {}

            // Each window is only triggered once via the reminderSent flags
            if (days <= 0 && !sub.reminderSent?.overdue) {
                await createAlert({
                    type: "Client",
                    subType: "SubscriptionRenewal",
                    title: `Overdue Renewal: ${label}`,
                    message: `Subscription for ${softwareName} (${customerName}) was due ${Math.abs(days)} day(s) ago. Please follow up immediately.`,
                    severity: "Urgent",
                    dueDate: sub.renewalDate,
                    customer: sub.customer?._id,
                    subscription: sub._id,
                    software: sub.softwares?._id,
                })
                updates["reminderSent.overdue"] = true
                alertsCreated++
            } else if (days <= 1 && days > 0 && !sub.reminderSent?.oneDay) {
                await createAlert({
                    type: "Client",
                    subType: "SubscriptionRenewal",
                    title: `Renewal Due Tomorrow: ${label}`,
                    message: `Subscription for ${softwareName} (${customerName}) renews tomorrow. Contact customer to confirm renewal.`,
                    severity: "Urgent",
                    dueDate: sub.renewalDate,
                    customer: sub.customer?._id,
                    subscription: sub._id,
                    software: sub.softwares?._id,
                })
                updates["reminderSent.oneDay"] = true
                alertsCreated++
            } else if (days <= 7 && days > 1 && !sub.reminderSent?.sevenDays) {
                await createAlert({
                    type: "Client",
                    subType: "SubscriptionRenewal",
                    title: `Renewal in ${days} Days: ${label}`,
                    message: `Subscription for ${softwareName} (${customerName}) renews in ${days} days. Prepare renewal invoice.`,
                    severity: "Warning",
                    dueDate: sub.renewalDate,
                    customer: sub.customer?._id,
                    subscription: sub._id,
                    software: sub.softwares?._id,
                })
                updates["reminderSent.sevenDays"] = true
                alertsCreated++
            } else if (days <= 30 && days > 7 && !sub.reminderSent?.thirtyDays) {
                await createAlert({
                    type: "Client",
                    subType: "SubscriptionRenewal",
                    title: `Renewal in ${days} Days: ${label}`,
                    message: `Subscription for ${softwareName} (${customerName}) renews in ${days} days.`,
                    severity: "Info",
                    dueDate: sub.renewalDate,
                    customer: sub.customer?._id,
                    subscription: sub._id,
                    software: sub.softwares?._id,
                })
                updates["reminderSent.thirtyDays"] = true
                alertsCreated++
            }

            if (Object.keys(updates).length > 0) {
                await Subscriptions.findByIdAndUpdate(sub._id, { $set: updates })
            }
            processed++
        }

        console.log(`[renewal.job] Done — ${processed} checked, ${alertsCreated} alerts created`)
    } catch (err) {
        console.error("[renewal.job] Error:", err.message)
    }
}

module.exports = runRenewalJob
