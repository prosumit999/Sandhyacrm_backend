const Invoices = require("../Models/Invoice.Schema")
const { createNotification } = require("../Services/notification.service")
const Users = require("../Models/user.schema")

// Runs daily at 7:00 AM IST — marks Pending invoices past their dueDate as Overdue
const runInvoiceJob = async () => {
    console.log("[invoice.job] Starting overdue invoice check...")

    try {
        const now = new Date()

        // Bulk mark all pending invoices past dueDate as Overdue
        const result = await Invoices.updateMany(
            { paymentStatus: "Pending", dueDate: { $lt: now } },
            { $set: { paymentStatus: "Overdue" } }
        )

        if (result.modifiedCount > 0) {
            console.log(`[invoice.job] Marked ${result.modifiedCount} invoices as Overdue`)

            // Notify SuperAdmin and Admin users about new overdue invoices
            const managers = await Users.find(
                { role: { $in: ["SuperAdmin", "Admin"] }, isActive: true },
                { _id: 1 }
            ).lean()

            for (const manager of managers) {
                await createNotification({
                    user: manager._id,
                    type: "PaymentOverdue",
                    title: `${result.modifiedCount} Invoice(s) Now Overdue`,
                    message: `${result.modifiedCount} invoice(s) have passed their due date and been marked overdue.`,
                    link: "/invoices?paymentStatus=Overdue",
                    linkedModel: "Invoices",
                })
            }
        }

        console.log("[invoice.job] Done")
    } catch (err) {
        console.error("[invoice.job] Error:", err.message)
    }
}

module.exports = runInvoiceJob
