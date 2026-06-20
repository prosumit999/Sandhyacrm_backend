const nodemailer = require("nodemailer")

// ── Transport ──────────────────────────────────────────────────────────────────
const createTransporter = () =>
    nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

// ── Layout helpers ─────────────────────────────────────────────────────────────
const co      = () => process.env.COMPANY_NAME || "CRM"
const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"
const fmtMoney= n  => (n != null && n !== "") ? "₹" + Number(n).toLocaleString("en-IN") : "—"
const fmtArr  = a  => (Array.isArray(a) && a.length) ? a.join(", ") : "—"

const tr = (label, value) =>
    (value !== undefined && value !== null && value !== "")
        ? "<tr>" +
          "<td style='padding:5px 20px 5px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top'>" + label + "</td>" +
          "<td style='padding:5px 0;font-size:13px;font-weight:600;color:#1f2937'>" + value + "</td>" +
          "</tr>"
        : ""

const tbl = rows => "<table style='border-collapse:collapse;margin:16px 0'>" + rows + "</table>"

const section = (title, rows) =>
    "<div style='margin:20px 0'>" +
    "<p style='margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px'>" + title + "</p>" +
    "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:4px 16px'>" +
    tbl(rows) +
    "</div></div>"

const branded = (body, accent) => {
    const color = accent || "#1a73e8"
    const footer =
        "<hr style='margin:28px 0;border:none;border-top:1px solid #e5e7eb'/>" +
        "<p style='margin:0;color:#9ca3af;font-size:12px'>" +
        co() + " &nbsp;|&nbsp; " + (process.env.COMPANY_EMAIL || "") +
        (process.env.COMPANY_PHONE ? " &nbsp;|&nbsp; " + process.env.COMPANY_PHONE : "") +
        "</p>"
    return (
        "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff'>" +
        "<div style='background:" + color + ";padding:16px 24px;border-radius:8px 8px 0 0'>" +
        "<span style='color:#fff;font-weight:700;font-size:16px'>" + co() + "</span>" +
        "</div>" +
        "<div style='padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px'>" +
        body + footer +
        "</div></div>"
    )
}

const send = async (to, subject, html) => {
    const t = createTransporter()
    await t.sendMail({ from: process.env.EMAIL_FROM, replyTo: process.env.EMAIL_REPLY_TO, to, subject, html })
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

const sendResetEmail = async (email, rawToken) => {
    const resetUrl = process.env.FRONTEND_URL + "/reset-password/" + rawToken
    await send(email, co() + " — Password Reset Request", branded(
        "<p style='margin:0 0 12px'>You requested a password reset for your " + co() + " account.</p>" +
        "<p>Click the button below — this link expires in <strong>10 minutes</strong>.</p>" +
        "<a href='" + resetUrl + "' style='display:inline-block;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0'>Reset Password</a>" +
        "<p style='color:#6b7280;font-size:13px'>If you did not request this, ignore this email.</p>" +
        "<p style='color:#9ca3af;font-size:11px'>Link: " + resetUrl + "</p>"
    ))
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER CREATED
// ═══════════════════════════════════════════════════════════════════════════════

// External — welcome email to customer when their account is created
const sendCustomerWelcomeEmail = async (email, {
    customerName, phone, whatsapp, businessName, subscriptionType,
    city, state, assignedStaffName,
}) => {
    const cityState = city ? city + (state ? ", " + state : "") : state
    await send(
        email,
        "Welcome to " + co() + " — Your Account is Ready",
        branded(
            "<p style='margin:0 0 16px'>Dear <strong>" + customerName + "</strong>,</p>" +
            "<p>Your account has been created with <strong>" + co() + "</strong>. Here are your details:</p>" +
            section("Your Account Details",
                tr("Business Name",   businessName) +
                tr("Phone",           phone) +
                tr("WhatsApp",        whatsapp) +
                tr("Application Type",subscriptionType) +
                tr("Location",        cityState) +
                tr("Account Manager", assignedStaffName)
            ) +
            "<p style='color:#374151'>If you have any questions, please reach us at <a href='mailto:" +
            (process.env.COMPANY_EMAIL || "") + "' style='color:#1a73e8'>" + (process.env.COMPANY_EMAIL || "") + "</a>.</p>" +
            "<p style='color:#374151'>Thank you for choosing " + co() + ".</p>"
        )
    )
}

// Internal — sent to assigned staff / admin when a new customer is created
const sendStaffNewCustomerEmail = async (email, {
    staffName, customerName, customerEmail, phone, whatsapp, businessName,
    subscriptionType, city, state, notes, createdByName,
}) => {
    const cityState = city ? city + (state ? ", " + state : "") : state
    await send(
        email,
        "New Customer Added — " + customerName + " — " + co(),
        branded(
            "<p style='margin:0 0 16px'>Hi <strong>" + staffName + "</strong>,</p>" +
            "<p>A new customer has been added and assigned to you. Please find the details below:</p>" +
            section("Customer Details",
                tr("Customer Name",   customerName) +
                tr("Email",          customerEmail) +
                tr("Phone",          phone) +
                tr("WhatsApp",       whatsapp) +
                tr("Business Name",  businessName) +
                tr("Application Type", subscriptionType) +
                tr("Location",       cityState) +
                tr("Notes",          notes) +
                tr("Created By",     createdByName)
            ) +
            "<p style='color:#374151'>Please log in to the CRM to view the full customer profile and get started.</p>",
            "#0f766e"
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOFTWARE ADDED / UPDATED
// ═══════════════════════════════════════════════════════════════════════════════

// Internal — sent to developer and managedBy when software is created or updated
const sendSoftwareInternalEmail = async (email, {
    staffName, softwareName, type, techStack, liveUrl, playStoreUrl, appStoreUrl,
    downloadUrl, hostingProvider, hostingExpiryDate, domainProvider, domainExpiryDate,
    sslExpiryDate, status, version, price, billingCycle, developerName, managedByName,
    teamName, isUpdate,
}) => {
    const action = isUpdate ? "Updated" : "Added"
    await send(
        email,
        "Software " + action + " — " + softwareName + " — " + co(),
        branded(
            "<p style='margin:0 0 16px'>Hi <strong>" + (staffName || "Team") + "</strong>,</p>" +
            "<p>The following software has been <strong>" + action.toLowerCase() + "</strong> in the system:</p>" +
            section("Software Overview",
                tr("Name",         softwareName) +
                tr("Type",         type) +
                tr("Status",       status) +
                tr("Version",      version) +
                tr("Tech Stack",   fmtArr(techStack)) +
                tr("Price",        fmtMoney(price)) +
                tr("Billing Cycle",billingCycle)
            ) +
            section("URLs",
                tr("Live URL",     liveUrl    ? "<a href='" + liveUrl + "' style='color:#1a73e8'>" + liveUrl + "</a>" : null) +
                tr("Play Store",   playStoreUrl ? "<a href='" + playStoreUrl + "' style='color:#1a73e8'>" + playStoreUrl + "</a>" : null) +
                tr("App Store",    appStoreUrl  ? "<a href='" + appStoreUrl  + "' style='color:#1a73e8'>" + appStoreUrl  + "</a>" : null) +
                tr("Download URL", downloadUrl  ? "<a href='" + downloadUrl  + "' style='color:#1a73e8'>" + downloadUrl  + "</a>" : null)
            ) +
            section("Hosting & Domain",
                tr("Hosting Provider", hostingProvider) +
                tr("Hosting Expiry",   fmtDate(hostingExpiryDate)) +
                tr("Domain Provider",  domainProvider) +
                tr("Domain Expiry",    fmtDate(domainExpiryDate)) +
                tr("SSL Expiry",       fmtDate(sslExpiryDate))
            ) +
            section("Team",
                tr("Developer",  developerName) +
                tr("Managed By", managedByName) +
                tr("Team",       teamName)
            ) +
            "<p style='color:#374151'>Please log in to the CRM for full details.</p>",
            "#7c3aed"
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CREATED
// ═══════════════════════════════════════════════════════════════════════════════

// Shared — set isInternal=true for staff/superadmin, false for customer
const sendSubscriptionCreatedEmail = async (email, {
    staffName, customerName, customerEmail, softwareName, softwareType,
    buyDate, renewalDate, billingCycle, amount, paymentStatus,
    invoiceNumber, periodFrom, periodTo,
    isInternal,
}) => {
    const subjectCustomer = "Your Subscription to " + softwareName + " is Active — " + co()
    const subjectInternal = "New Subscription Created — " + customerName + " / " + softwareName + " — " + co()

    const greeting = isInternal
        ? "<p style='margin:0 0 16px'>Hi <strong>" + (staffName || "Team") + "</strong>,</p>" +
          "<p>A new subscription has been created. Please find the details below:</p>"
        : "<p style='margin:0 0 16px'>Dear <strong>" + customerName + "</strong>,</p>" +
          "<p>Your subscription to <strong>" + softwareName + "</strong> has been activated successfully.</p>"

    const customerRow = isInternal
        ? tr("Customer",       customerName) + tr("Customer Email", customerEmail)
        : ""

    await send(
        email,
        isInternal ? subjectInternal : subjectCustomer,
        branded(
            greeting +
            section("Subscription Details",
                customerRow +
                tr("Software",       softwareName) +
                tr("Type",           softwareType) +
                tr("Buy Date",       fmtDate(buyDate)) +
                tr("Renewal Date",   fmtDate(renewalDate)) +
                tr("Billing Cycle",  billingCycle) +
                tr("Amount",         fmtMoney(amount)) +
                tr("Payment Status", paymentStatus)
            ) +
            section("Invoice Details",
                tr("Invoice #",    invoiceNumber) +
                tr("Period From",  fmtDate(periodFrom)) +
                tr("Period To",    fmtDate(periodTo)) +
                tr("Total Amount", fmtMoney(amount)) +
                tr("Status",       paymentStatus)
            ) +
            (isInternal
                ? "<p style='color:#374151'>Log in to the CRM to view or manage this subscription.</p>"
                : "<p style='color:#374151'>Thank you for your business. Please contact us if you have any questions.</p>"
            ),
            isInternal ? "#0f766e" : "#1a73e8"
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL INVOICE (created from Invoices section)
// ═══════════════════════════════════════════════════════════════════════════════

const sendDetailedInvoiceEmail = async (email, {
    customerName, invoiceNumber, softwareName, softwareType,
    amount, tax, discount, totalAmount, invoiceType,
    periodFrom, periodTo, paymentStatus, dueDate,
}) => {
    await send(
        email,
        "Invoice " + invoiceNumber + " — " + co(),
        branded(
            "<p style='margin:0 0 16px'>Dear <strong>" + customerName + "</strong>,</p>" +
            "<p>Please find your invoice details below.</p>" +
            section("Invoice Details",
                tr("Invoice #",    invoiceNumber) +
                tr("Invoice Type", invoiceType) +
                tr("Software",     softwareName) +
                tr("Type",         softwareType)
            ) +
            section("Amount Breakdown",
                tr("Amount",       fmtMoney(amount)) +
                tr("Tax / GST",    tax    ? fmtMoney(tax)     : null) +
                tr("Discount",     discount ? fmtMoney(discount) : null) +
                tr("Total Amount", fmtMoney(totalAmount))
            ) +
            section("Period & Payment",
                tr("Period From",    fmtDate(periodFrom)) +
                tr("Period To",      fmtDate(periodTo)) +
                tr("Due Date",       fmtDate(dueDate)) +
                tr("Payment Status", paymentStatus)
            ) +
            "<p style='color:#374151'>If you have any questions about this invoice, please contact us at <a href='mailto:" +
            (process.env.COMPANY_EMAIL || "") + "' style='color:#1a73e8'>" + (process.env.COMPANY_EMAIL || "") + "</a>.</p>" +
            "<p style='color:#374151'>Thank you for your business.</p>"
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

// External — sent to customer when a Client alert is created
const sendCustomerAlertEmail = async (email, { customerName, title, message, severity, dueDate }) => {
    const severityColor = severity === "Urgent" ? "#dc2626" : severity === "Warning" ? "#d97706" : "#2563eb"
    const severityLabel = severity || "Info"
    await send(
        email,
        "[" + severityLabel + "] " + title + " — " + co(),
        branded(
            "<p style='margin:0 0 8px'>Dear <strong>" + customerName + "</strong>,</p>" +
            "<h2 style='margin:0 0 12px;font-size:18px;color:#111'>" + title + "</h2>" +
            "<p style='color:#374151;line-height:1.6'>" + message + "</p>" +
            (dueDate
                ? "<p style='margin:16px 0 0;color:#6b7280;font-size:13px'>Due date: <strong>" + fmtDate(dueDate) + "</strong></p>"
                : ""
            ),
            severityColor
        )
    )
}

// Internal — sent to assigned staff when a manual Client alert is created
const sendAlertStaffEmail = async (email, {
    staffName, customerName, alertType, subType, title, message, severity, dueDate,
}) => {
    const severityColor = severity === "Urgent" ? "#dc2626" : severity === "Warning" ? "#d97706" : "#2563eb"
    const severityLabel = severity || "Info"
    await send(
        email,
        "[Internal] " + severityLabel + " Alert — " + customerName + " — " + co(),
        branded(
            "<p style='margin:0 0 16px'>Hi <strong>" + (staffName || "Team") + "</strong>,</p>" +
            "<p>A new alert has been created for one of your assigned customers.</p>" +
            section("Alert Details",
                tr("Customer",   customerName) +
                tr("Type",       alertType) +
                tr("Sub Type",   subType) +
                tr("Severity",   severityLabel) +
                tr("Title",      title) +
                tr("Message",    message) +
                tr("Due Date",   fmtDate(dueDate))
            ) +
            "<p style='color:#374151'>Please log in to the CRM to review and take action on this alert.</p>",
            severityColor
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL
// ═══════════════════════════════════════════════════════════════════════════════

const sendPortalWelcomeEmail = async (email, { customerName, portalPassword, loginUrl }) => {
    await send(
        email,
        "Your Customer Portal Access — " + co(),
        branded(
            "<p>Dear <strong>" + customerName + "</strong>,</p>" +
            "<p>Your customer portal access has been activated. You can now log in to view your subscriptions, invoices, tickets, and more.</p>" +
            tbl(
                tr("Email",    email) +
                tr("Password", portalPassword)
            ) +
            (loginUrl
                ? "<a href='" + loginUrl + "' style='display:inline-block;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0'>Access Your Portal &rarr;</a>"
                : ""
            ) +
            "<p style='margin:16px 0 0;color:#6b7280;font-size:13px'>Please change your password after first login.</p>"
        )
    )
}

const sendPortalResetEmail = async (email, { customerName, resetUrl }) => {
    await send(
        email,
        "Reset Your Portal Password — " + co(),
        branded(
            "<p>Dear <strong>" + customerName + "</strong>,</p>" +
            "<p>We received a request to reset your customer portal password. Click the button below — this link expires in <strong>10 minutes</strong>.</p>" +
            "<a href='" + resetUrl + "' style='display:inline-block;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0'>Reset Password</a>" +
            "<p style='color:#6b7280;font-size:13px'>If you did not request this, ignore this email.</p>" +
            "<p style='color:#9ca3af;font-size:11px'>Link: " + resetUrl + "</p>"
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════════

const sendPaymentConfirmationEmail = async (email, {
    customerName, invoiceNumber, totalAmount, paymentDate, paymentMethod,
}) => {
    await send(
        email,
        "Payment Received — Invoice " + invoiceNumber + " — " + co(),
        branded(
            "<p>Dear <strong>" + customerName + "</strong>,</p>" +
            "<p>Thank you! We have received your payment.</p>" +
            tbl(
                tr("Invoice #",    invoiceNumber) +
                tr("Amount Paid",  fmtMoney(totalAmount)) +
                tr("Payment Date", fmtDate(paymentDate)) +
                tr("Payment Via",  paymentMethod)
            ) +
            "<p style='color:#374151'>Thank you for your business.</p>",
            "#16a34a"
        )
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    sendResetEmail,
    // Customer
    sendCustomerWelcomeEmail,
    sendStaffNewCustomerEmail,
    // Software
    sendSoftwareInternalEmail,
    // Subscription
    sendSubscriptionCreatedEmail,
    // Invoice
    sendDetailedInvoiceEmail,
    // Alerts
    sendCustomerAlertEmail,
    sendAlertStaffEmail,
    // Portal
    sendPortalWelcomeEmail,
    sendPortalResetEmail,
    // Payment
    sendPaymentConfirmationEmail,
}
