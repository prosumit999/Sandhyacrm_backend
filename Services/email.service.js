const nodemailer = require("nodemailer")

// Create transporter once — reused across all email calls
const createTransporter = () =>
    nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

// Send password reset link — resolves GOTCHA-009 from auth.controller.js
const sendResetEmail = async (email, rawToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`
    const transporter = createTransporter()

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: `${process.env.COMPANY_NAME} — Password Reset Request`,
        html: `
            <p>You requested a password reset for your ${process.env.COMPANY_NAME} account.</p>
            <p>Click the link below to reset your password. This link expires in <strong>10 minutes</strong>.</p>
            <a href="${resetUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
              Reset Password
            </a>
            <p>If you did not request this, ignore this email. Your password will not change.</p>
            <p style="color:#999;font-size:12px">Link: ${resetUrl}</p>
        `,
    })
}

// Invoice ready notification
const sendInvoiceEmail = async (email, { invoiceNumber, customerName, totalAmount, dueDate, pdfUrl }) => {
    const transporter = createTransporter()

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: `Invoice ${invoiceNumber} — ${process.env.COMPANY_NAME}`,
        html: `
            <p>Dear ${customerName},</p>
            <p>Please find your invoice details below:</p>
            <table style="border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0"><strong>Invoice #</strong></td><td>${invoiceNumber}</td></tr>
              <tr><td style="padding:4px 12px 4px 0"><strong>Amount</strong></td><td>₹${totalAmount}</td></tr>
              ${dueDate ? `<tr><td style="padding:4px 12px 4px 0"><strong>Due Date</strong></td><td>${new Date(dueDate).toLocaleDateString("en-IN")}</td></tr>` : ""}
            </table>
            ${pdfUrl ? `<p><a href="${pdfUrl}">Download Invoice PDF</a></p>` : ""}
            <p>Thank you for your business.</p>
            <p><strong>${process.env.COMPANY_NAME}</strong><br/>${process.env.COMPANY_EMAIL || ""}</p>
        `,
    })
}

// Generic alert notification email
const sendAlertEmail = async (email, { subject, bodyHtml }) => {
    const transporter = createTransporter()
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to: email, subject, html: bodyHtml })
}

module.exports = { sendResetEmail, sendInvoiceEmail, sendAlertEmail }
