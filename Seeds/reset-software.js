const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

const Alerts = require("../Models/Alert.Schema")
const AuditLogs = require("../Models/AuditLog.schema")
const Communications = require("../Models/Communication.schema")
const Conversations = require("../Models/Conversation.schema")
const Customers = require("../Models/Customer.model")
const Invoices = require("../Models/Invoice.Schema")
const Messages = require("../Models/Message.schema")
const Notifications = require("../Models/Notification.schema")
const PortalMessages = require("../Models/PortalMessage.schema")
const PortalNotifications = require("../Models/PortalNotification.schema")
const Settings = require("../Models/Settings.schema")
const Softwares = require("../Models/Softwares.schema")
const Subscriptions = require("../Models/Subscription.Schema")
const SupportTickets = require("../Models/SupportTicket.schema")
const Tags = require("../Models/Tag.schema")
const Team = require("../Models/Team.schema")
const Users = require("../Models/user.schema")

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const shouldReset = process.argv.includes("--yes") || process.env.RESET_SOFTWARE_CONFIRM === "true"

const collections = [
    ["Alerts", Alerts],
    ["Audit logs", AuditLogs],
    ["Communications", Communications],
    ["Conversations", Conversations],
    ["Customers", Customers],
    ["Invoices", Invoices],
    ["Messages", Messages],
    ["Notifications", Notifications],
    ["Portal messages", PortalMessages],
    ["Portal notifications", PortalNotifications],
    ["Settings", Settings],
    ["Softwares", Softwares],
    ["Subscriptions", Subscriptions],
    ["Support tickets", SupportTickets],
    ["Tags", Tags],
    ["Teams", Team],
    ["Users", Users],
]

const connectDB = async () => {
    const dbUrl = process.env.MONGO_URI
    if (!dbUrl) throw new Error("MONGO_URI is missing in Backend/.env")

    await mongoose.connect(dbUrl)
    console.log("Database connected for software reset")
}

const resetSoftware = async () => {
    for (const [label, model] of collections) {
        const result = await model.deleteMany({})
        console.log(`${label}: deleted ${result.deletedCount}`)
    }
}

const main = async () => {
    if (!shouldReset) {
        console.log("Reset cancelled. This seed deletes all CRM data, including SuperAdmin, Admin, Standard users, customers, subscriptions, invoices, tickets, messages, settings, and logs.")
        console.log("Run: npm run seed:reset -- --yes")
        return
    }

    try {
        await connectDB()
        await resetSoftware()
        console.log("Software reset complete. Database is fresh.")
    } catch (err) {
        console.error(err.message)
        process.exitCode = 1
    } finally {
        await mongoose.connection.close()
        console.log("Database connection closed")
    }
}

main()
