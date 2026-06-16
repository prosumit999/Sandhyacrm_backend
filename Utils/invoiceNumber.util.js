const Invoices = require("../Models/Invoice.Schema")
const SupportTickets = require("../Models/SupportTicket.schema")

// Query DB for the last invoice number this year and increment — avoids collision via findOne sort
const generateInvoiceNumber = async () => {
    const year = new Date().getFullYear()
    const prefix = `INV-${year}-`

    const last = await Invoices.findOne(
        { invoiceNumber: { $regex: `^${prefix}` } },
        { invoiceNumber: 1 }
    ).sort({ invoiceNumber: -1 }).lean()

    if (!last) return `${prefix}0001`

    const seq = parseInt(last.invoiceNumber.replace(prefix, ""), 10) || 0
    return `${prefix}${String(seq + 1).padStart(4, "0")}`
}

// Same sequential pattern for support tickets — TKT-YYYY-XXXX
const generateTicketNumber = async () => {
    const year = new Date().getFullYear()
    const prefix = `TKT-${year}-`

    const last = await SupportTickets.findOne(
        { ticketNumber: { $regex: `^${prefix}` } },
        { ticketNumber: 1 }
    ).sort({ ticketNumber: -1 }).lean()

    if (!last) return `${prefix}0001`

    const seq = parseInt(last.ticketNumber.replace(prefix, ""), 10) || 0
    return `${prefix}${String(seq + 1).padStart(4, "0")}`
}

module.exports = { generateInvoiceNumber, generateTicketNumber }
