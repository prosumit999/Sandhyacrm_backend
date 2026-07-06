const express = require("express")
const http    = require("http")
const { Server } = require("socket.io")
const app = express()
const dotenv = require("dotenv")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const databaseConnection = require("./config/db.config")
const startJobs = require("./Cron/index")

// Route imports
const authRoute = require("./Routes/auth.route")
const userRoute = require("./Routes/user.route")
const dashboardRoute = require("./Routes/dashboard.route")
const reportRoute = require("./Routes/report.route")
const customerRoute = require("./Routes/customer.route")
const softwareRoute = require("./Routes/software.route")
const subscriptionRoute = require("./Routes/subscription.route")
const invoiceRoute = require("./Routes/invoice.route")
const alertRoute = require("./Routes/alert.route")
const tagRoute = require("./Routes/tag.route")
const communicationRoute = require("./Routes/communication.route")
const ticketRoute = require("./Routes/ticket.route")
const notificationRoute = require("./Routes/notification.route")
const auditlogRoute = require("./Routes/auditlog.route")
const settingsRoute = require("./Routes/settings.route")
const socialRoute   = require("./Routes/social.route")
const teamRoute     = require("./Routes/team.route")
const chatRoute     = require("./Routes/chat.route")
const portalRoute   = require("./Routes/portal.route")

dotenv.config()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

const devOriginPatterns = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/,
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
]

const isAllowedOrigin = (origin) => {
    if (!origin || allowedOrigins.includes(origin)) return true
    if (process.env.NODE_ENV !== "production") {
        return devOriginPatterns.some(pattern => pattern.test(origin))
    }
    return false
}

app.use(cors({
    origin: (origin, cb) => {
        // allow native/mobile clients (no origin) and any listed origin
        if (isAllowedOrigin(origin)) return cb(null, true)
        cb(new Error(`CORS: ${origin} not allowed`))
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}))

databaseConnection()
startJobs()

app.get("/", (req, res) => res.send("Sandhya CRM API"))

// API routes
app.use("/api/v1/auth", authRoute)
app.use("/api/v1/users", userRoute)
app.use("/api/v1/dashboard", dashboardRoute)
app.use("/api/v1/customers", customerRoute)
app.use("/api/v1/softwares", softwareRoute)
app.use("/api/v1/subscriptions", subscriptionRoute)
app.use("/api/v1/invoices", invoiceRoute)
app.use("/api/v1/alerts", alertRoute)
app.use("/api/v1/tags", tagRoute)
app.use("/api/v1/communications", communicationRoute)
app.use("/api/v1/tickets", ticketRoute)
app.use("/api/v1/notifications", notificationRoute)
app.use("/api/v1/audit", auditlogRoute)
app.use("/api/v1/reports", reportRoute)
app.use("/api/v1/settings", settingsRoute)
app.use("/api/v1/social",   socialRoute)
app.use("/api/v1/teams",    teamRoute)
app.use("/api/v1/chat",     chatRoute)
app.use("/api/v1/portal",   portalRoute)

// Global 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" })
})

// Global error handler
app.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: err.message || "Internal Server Error" })
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true)
      cb(new Error(`CORS: ${origin} not allowed`))
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
})

require("./socket/chatSocket")(io)

const port = process.env.PORT || 5000
server.listen(port, () => {
  console.log("App is running on port " + port)
})
