const Invoices = require("../Models/Invoice.Schema")
const Subscriptions = require("../Models/Subscription.Schema")
const Softwares = require("../Models/Softwares.schema")
const Communications = require("../Models/Communication.schema")
const Customers = require("../Models/Customer.model")

// Revenue by month for a given year — bar chart data
const getRevenueReport = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear()
        const startOfYear = new Date(year, 0, 1)
        const endOfYear = new Date(year + 1, 0, 1)

        // Match paid invoices within the year; fall back to updatedAt when paymentDate is missing
        const paidInYearMatch = {
            paymentStatus: "Paid",
            $or: [
                { paymentDate: { $gte: startOfYear, $lt: endOfYear } },
                { paymentDate: null, updatedAt: { $gte: startOfYear, $lt: endOfYear } },
                { paymentDate: { $exists: false }, updatedAt: { $gte: startOfYear, $lt: endOfYear } },
            ],
        }

        const [monthlyRevenue, bySoftware, byInvoiceType] = await Promise.all([
            Invoices.aggregate([
                { $match: paidInYearMatch },
                {
                    $group: {
                        _id: { month: { $month: { $ifNull: ["$paymentDate", "$updatedAt"] } } },
                        total: { $sum: "$totalAmount" },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { "_id.month": 1 } },
            ]),
            Invoices.aggregate([
                { $match: paidInYearMatch },
                { $group: { _id: "$software", total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
                { $lookup: { from: "softwares", localField: "_id", foreignField: "_id", as: "software" } },
                { $unwind: { path: "$software", preserveNullAndEmptyArrays: true } },
                { $project: { softwareName: "$software.name", total: 1, count: 1 } },
                { $sort: { total: -1 } },
                { $limit: 10 },
            ]),
            Invoices.aggregate([
                { $match: paidInYearMatch },
                { $group: { _id: "$invoiceType", total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            ]),
        ])

        // Build full 12-month array with 0 for months with no revenue
        const monthly = Array.from({ length: 12 }, (_, i) => {
            const found = monthlyRevenue.find((r) => r._id.month === i + 1)
            return { month: i + 1, total: found?.total || 0, count: found?.count || 0 }
        })

        res.status(200).json({
            success: true,
            message: `Revenue report for ${year}`,
            data: {
                year,
                monthly,
                bySoftware,
                byInvoiceType: byInvoiceType.reduce((acc, r) => { acc[r._id] = { total: r.total, count: r.count }; return acc }, {}),
                totalRevenue: monthly.reduce((sum, m) => sum + m.total, 0),
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Subscription trends — new, cancelled, active totals by month
const getSubscriptionReport = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear()
        const startOfYear = new Date(year, 0, 1)
        const endOfYear = new Date(year + 1, 0, 1)

        const [newByMonth, statusCounts, byBillingCycle] = await Promise.all([
            Subscriptions.aggregate([
                { $match: { createdAt: { $gte: startOfYear, $lt: endOfYear } } },
                { $group: { _id: { month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { "_id.month": 1 } },
            ]),
            Subscriptions.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            Subscriptions.aggregate([
                { $match: { status: "Active" } },
                { $group: { _id: "$billingCycle", count: { $sum: 1 } } },
            ]),
        ])

        const monthly = Array.from({ length: 12 }, (_, i) => {
            const found = newByMonth.find((r) => r._id.month === i + 1)
            return { month: i + 1, newSubscriptions: found?.count || 0 }
        })

        res.status(200).json({
            success: true,
            message: `Subscription report for ${year}`,
            data: {
                year,
                monthly,
                statusBreakdown: statusCounts.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {}),
                billingCycleBreakdown: byBillingCycle.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {}),
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Per-software performance — revenue, subscriber count, ticket count
const getSoftwareReport = async (req, res) => {
    try {
        const [softwares, revenuePerSoftware, subsPerSoftware] = await Promise.all([
            Softwares.find({}, { name: 1, type: 1, status: 1, billingCycle: 1, price: 1 }).lean(),
            Invoices.aggregate([
                { $match: { paymentStatus: "Paid" } },
                { $group: { _id: "$software", totalRevenue: { $sum: "$totalAmount" }, invoiceCount: { $sum: 1 } } },
            ]),
            Subscriptions.aggregate([
                { $group: { _id: "$softwares", activeCount: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } }, totalCount: { $sum: 1 } } },
            ]),
        ])

        const revenueMap = revenuePerSoftware.reduce((acc, r) => { acc[r._id] = { totalRevenue: r.totalRevenue, invoiceCount: r.invoiceCount }; return acc }, {})
        const subsMap = subsPerSoftware.reduce((acc, r) => { acc[r._id] = { activeCount: r.activeCount, totalCount: r.totalCount }; return acc }, {})

        const report = softwares.map((sw) => ({
            ...sw,
            revenue: revenueMap[sw._id] || { totalRevenue: 0, invoiceCount: 0 },
            subscriptions: subsMap[sw._id] || { activeCount: 0, totalCount: 0 },
        }))

        report.sort((a, b) => (b.revenue.totalRevenue || 0) - (a.revenue.totalRevenue || 0))

        res.status(200).json({ success: true, message: "Software report fetched", data: report })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// Communication activity report — by channel, delivery status, purpose, date range
const getCommunicationReport = async (req, res) => {
    try {
        const { from, to } = req.query
        const dateFilter = {}
        if (from) dateFilter.$gte = new Date(from)
        if (to) dateFilter.$lte = new Date(to)
        const match = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

        const [byChannel, byDeliveryStatus, byPurpose, daily] = await Promise.all([
            Communications.aggregate([{ $match: match }, { $group: { _id: "$channel", count: { $sum: 1 } } }]),
            Communications.aggregate([{ $match: match }, { $group: { _id: "$deliveryStatus", count: { $sum: 1 } } }]),
            Communications.aggregate([{ $match: match }, { $group: { _id: "$purpose", count: { $sum: 1 } } }]),
            Communications.aggregate([
                { $match: match },
                { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
                { $limit: 90 },
            ]),
        ])

        res.status(200).json({
            success: true,
            message: "Communication report fetched",
            data: {
                byChannel: byChannel.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {}),
                byDeliveryStatus: byDeliveryStatus.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {}),
                byPurpose: byPurpose.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {}),
                daily,
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getRevenueReport, getSubscriptionReport, getSoftwareReport, getCommunicationReport }
