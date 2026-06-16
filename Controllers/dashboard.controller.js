const Users = require("../Models/user.schema")
const Customers = require("../Models/Customer.model")
const Softwares = require("../Models/Softwares.schema")
const Subscriptions = require("../Models/Subscription.Schema")
const Invoices = require("../Models/Invoice.Schema")
const Alerts = require("../Models/Alert.Schema")
const SupportTickets = require("../Models/SupportTicket.schema")
const Communications = require("../Models/Communication.schema")
const AuditLogs = require("../Models/AuditLog.schema")
const { addDays } = require("../Utils/date.util")

// Top-level KPIs — revenue, counts, overdue summary
const getKPIs = async (req, res) => {
    try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfYear = new Date(now.getFullYear(), 0, 1)

        const [
            totalCustomers,
            newCustomersThisMonth,
            activeSubscriptions,
            totalUsers,
            pendingAlerts,
            openTickets,
            revenueThisMonth,
            revenueThisYear,
            overdueInvoices,
        ] = await Promise.all([
            Customers.countDocuments({}),
            Customers.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Subscriptions.countDocuments({ status: "Active" }),
            Users.countDocuments({ isActive: true }),
            Alerts.countDocuments({ status: "Pending" }),
            SupportTickets.countDocuments({ status: { $in: ["Open", "InProgress"] } }),
            Invoices.aggregate([
                { $match: { paymentStatus: "Paid", paymentDate: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),
            Invoices.aggregate([
                { $match: { paymentStatus: "Paid", paymentDate: { $gte: startOfYear } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),
            Invoices.aggregate([
                { $match: { paymentStatus: "Overdue" } },
                { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
            ]),
        ])

        res.status(200).json({
            success: true,
            message: "KPIs fetched",
            data: {
                customers: { total: totalCustomers, newThisMonth: newCustomersThisMonth },
                subscriptions: { active: activeSubscriptions },
                users: { active: totalUsers },
                alerts: { pending: pendingAlerts },
                tickets: { open: openTickets },
                revenue: {
                    thisMonth: revenueThisMonth[0]?.total || 0,
                    thisYear: revenueThisYear[0]?.total || 0,
                },
                overdueInvoices: {
                    count: overdueInvoices[0]?.count || 0,
                    totalAmount: overdueInvoices[0]?.total || 0,
                },
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Subscriptions renewing in the next N days (default 30)
const getUpcomingRenewals = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30
        const cutoff = addDays(new Date(), days)

        const renewals = await Subscriptions.find({
            status: "Active",
            renewalDate: { $gte: new Date(), $lte: cutoff },
        })
            .populate("customer", "name phone email")
            .populate("softwares", "name type")
            .sort({ renewalDate: 1 })
            .limit(50)

        res.status(200).json({ success: true, message: "Upcoming renewals fetched", data: renewals })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Pending infra alerts (domain, hosting, SSL expiry)
const getInfraAlerts = async (req, res) => {
    try {
        const alerts = await Alerts.find({
            type: "Infra",
            status: { $in: ["Pending", "Snoozed"] },
        })
            .populate("software", "name liveUrl hostingProvider domainProvider")
            .sort({ dueDate: 1 })
            .limit(30)

        res.status(200).json({ success: true, message: "Infra alerts fetched", data: alerts })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Software status breakdown and list of Broken/Maintenance softwares
const getSoftwareStatus = async (req, res) => {
    try {
        const [statusCounts, brokenSoftwares] = await Promise.all([
            Softwares.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Softwares.find({ status: { $in: ["Broken", "Maintenance"] } })
                .populate("developer", "name")
                .select("name type status liveUrl lastCheckedAt developer"),
        ])

        const counts = statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc }, {})
        res.status(200).json({ success: true, message: "Software status fetched", data: { counts, brokenSoftwares } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Recent audit activity — last 15 actions across all models
const getRecentActivity = async (req, res) => {
    try {
        const activity = await AuditLogs.find({})
            .populate("performedBy", "name role")
            .sort({ createdAt: -1 })
            .limit(15)
            .select("performedBy action targetModel targetLabel createdAt")

        res.status(200).json({ success: true, message: "Recent activity fetched", data: activity })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Alert severity breakdown
const getAlertSummary = async (req, res) => {
    try {
        const [bySeverity, byType] = await Promise.all([
            Alerts.aggregate([
                { $match: { status: "Pending" } },
                { $group: { _id: "$severity", count: { $sum: 1 } } },
            ]),
            Alerts.aggregate([
                { $match: { status: "Pending" } },
                { $group: { _id: "$type", count: { $sum: 1 } } },
            ]),
        ])

        res.status(200).json({
            success: true,
            message: "Alert summary fetched",
            data: {
                bySeverity: bySeverity.reduce((acc, a) => { acc[a._id] = a.count; return acc }, {}),
                byType: byType.reduce((acc, a) => { acc[a._id] = a.count; return acc }, {}),
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Personal overview for a Standard user — their customers, renewals, overdue invoices, alerts
const getMyOverview = async (req, res) => {
    try {
        const userId = req.user.id
        const now    = new Date()
        const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const myCustomerIds = await Customers.distinct("_id", { serviceUser: userId })

        const [customers, upcomingRenewals, overdueInvoices, pendingAlerts] = await Promise.all([
            Customers.find({ serviceUser: userId })
                .select("name email phone businessName status referrredBy createdAt")
                .sort({ createdAt: -1 }),
            Subscriptions.find({
                customer: { $in: myCustomerIds },
                status: "Active",
                renewalDate: { $gte: now, $lte: thirtyDaysOut },
            })
                .populate("customer", "name phone email")
                .populate("softwares", "name type")
                .sort({ renewalDate: 1 }),
            Invoices.find({ customer: { $in: myCustomerIds }, paymentStatus: "Overdue" })
                .populate("customer", "name phone")
                .populate("software", "name")
                .sort({ createdAt: -1 })
                .limit(20),
            Alerts.find({ customer: { $in: myCustomerIds }, status: "Pending" })
                .populate("customer", "name")
                .select("title severity dueDate subType status customer")
                .sort({ dueDate: 1 })
                .limit(10),
        ])

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalCustomers:   customers.length,
                    activeCustomers:  customers.filter(c => c.status === "Active").length,
                    leadCustomers:    customers.filter(c => c.status === "Lead").length,
                    upcomingRenewals: upcomingRenewals.length,
                    overdueCount:     overdueInvoices.length,
                    overdueAmount:    overdueInvoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0),
                },
                customers,
                upcomingRenewals,
                overdueInvoices,
                pendingAlerts,
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getKPIs, getUpcomingRenewals, getInfraAlerts, getSoftwareStatus, getRecentActivity, getAlertSummary, getMyOverview }
