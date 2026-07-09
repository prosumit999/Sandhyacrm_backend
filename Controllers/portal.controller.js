const crypto        = require("crypto")
const bcryptjs      = require("bcryptjs")
const jwt           = require("jsonwebtoken")
const Customers     = require("../Models/Customer.model")
const Users         = require("../Models/user.schema")
const Subscriptions = require("../Models/Subscription.Schema")
const Invoices      = require("../Models/Invoice.Schema")
const Alerts        = require("../Models/Alert.Schema")
const SupportTickets= require("../Models/SupportTicket.schema")
const PortalMessage = require("../Models/PortalMessage.schema")
const { sendPortalWelcomeEmail, sendPortalResetEmail } = require("../Services/email.service")
const { createPortalNotification } = require("../Services/portalNotification.service")
const { authCookieOptions, clearCookieOptions } = require("../Utils/cookie.util")

// ── Auth ───────────────────────────────────────────────────────────────────

const portalLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required" })

    const customer = await Customers.findOne({ email: email.toLowerCase().trim() })
    if (!customer)
      return res.status(401).json({ success: false, message: "Invalid credentials" })
    if (!customer.portalAccess)
      return res.status(403).json({ success: false, message: "Portal access not enabled for this account. Contact your service manager." })
    if (!customer.portalPassword)
      return res.status(403).json({ success: false, message: "Portal password not set. Contact your service manager." })

    const isMatch = await bcryptjs.compare(password, customer.portalPassword)
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Invalid credentials" })

    const token = jwt.sign(
      { id: customer._id, email: customer.email, name: customer.name },
      process.env.JWT_SEC,
      { expiresIn: "7d" }
    )

    res.cookie("portaltoken", token, authCookieOptions(7 * 24 * 60 * 60 * 1000))
    res.json({
      success: true,
      message: "Logged in",
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        businessName: customer.businessName,
        phone: customer.phone,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const portalLogout = (req, res) => {
  res.clearCookie("portaltoken", clearCookieOptions())
  res.json({ success: true, message: "Logged out" })
}

const portalMe = async (req, res) => {
  try {
    const customer = await Customers.findById(req.customer.id)
      .select("-portalPassword")
      .populate("serviceUser", "name email phone role ProfilePhoto")
    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" })
    res.json({ success: true, data: customer })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────

const portalDashboard = async (req, res) => {
  try {
    const cid = req.customer.id
    const [subs, invoices, alerts, tickets, unreadMessages] = await Promise.all([
      Subscriptions.countDocuments({ customer: cid }),
      Invoices.countDocuments({ customer: cid }),
      Alerts.countDocuments({ customer: cid }),
      SupportTickets.countDocuments({ customer: cid }),
      PortalMessage.countDocuments({ customer: cid, sender: "team", readByCustomer: false }),
    ])
    const activeSubs    = await Subscriptions.countDocuments({ customer: cid, status: "Active" })
    const openTickets   = await SupportTickets.countDocuments({ customer: cid, status: { $in: ["Open", "InProgress", "WaitingOnClient"] } })
    const pendingInvoices = await Invoices.countDocuments({ customer: cid, paymentStatus: "Pending" })
    const urgentAlerts  = await Alerts.countDocuments({ customer: cid, severity: { $in: ["Urgent", "Warning"] } })

    res.json({
      success: true,
      data: {
        subscriptions: { total: subs, active: activeSubs },
        invoices:      { total: invoices, pending: pendingInvoices },
        alerts:        { total: alerts, urgent: urgentAlerts },
        tickets:       { total: tickets, open: openTickets },
        unreadMessages,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Subscriptions ──────────────────────────────────────────────────────────

const portalSubscriptions = async (req, res) => {
  try {
    const subs = await Subscriptions.find({ customer: req.customer.id })
      .populate("softwares", "name type description liveUrl playStoreUrl appStoreUrl downloadUrl documentationUrl status")
      .sort({ status: 1, renewalDate: 1 })
    res.json({ success: true, data: subs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Invoices ───────────────────────────────────────────────────────────────

const portalInvoices = async (req, res) => {
  try {
    const invs = await Invoices.find({ customer: req.customer.id })
      .populate("software", "name type")
      .sort({ createdAt: -1 })
    res.json({ success: true, data: invs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const portalSubmitPaymentReference = async (req, res) => {
  try {
    const { reference, note } = req.body
    if (!reference?.trim()) {
      return res.status(400).json({ success: false, message: "Payment reference is required" })
    }

    const invoice = await Invoices.findOneAndUpdate(
      {
        _id: req.params.id,
        customer: req.customer.id,
        paymentStatus: { $in: ["Pending", "Overdue"] },
      },
      {
        customerPaymentReference: reference.trim(),
        customerPaymentNote: (note || "").trim(),
        customerPaymentSubmittedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).populate("software", "name type")

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found or already paid" })
    }

    res.json({ success: true, message: "Payment reference submitted", data: invoice })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Alerts ─────────────────────────────────────────────────────────────────

const portalAlerts = async (req, res) => {
  try {
    const alts = await Alerts.find({ customer: req.customer.id })
      .populate("software", "name type")
      .sort({ dueDate: 1 })
    res.json({ success: true, data: alts })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Tickets ────────────────────────────────────────────────────────────────

const portalTickets = async (req, res) => {
  try {
    const tickets = await SupportTickets.find({ customer: req.customer.id })
      .populate("software", "name type")
      .populate("assignedTo", "name email role ProfilePhoto")
      .sort({ createdAt: -1 })
      .select("-replies.isInternal")
    res.json({ success: true, data: tickets })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const portalCreateTicket = async (req, res) => {
  try {
    const { title, type, priority, description, software } = req.body
    if (!title || !type || !software)
      return res.status(400).json({ success: false, message: "title, type and software are required" })

    // Auto-generate ticket number
    const count = await SupportTickets.countDocuments()
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`

    // Find admin to assign as createdBy
    const cid = req.customer.id
    const customer = await Customers.findById(cid)

    const ticket = await SupportTickets.create({
      ticketNumber,
      customer:   cid,
      software,
      title,
      type,
      priority:   priority || "Medium",
      description,
      createdBy:  customer.serviceUser,
      assignedTo: customer.serviceUser,
      dueBy:      new Date(Date.now() + 10 * 60 * 1000),
    })

    res.status(201).json({ success: true, data: ticket })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const portalTicketDetail = async (req, res) => {
  try {
    const ticket = await SupportTickets.findOne({ _id: req.params.id, customer: req.customer.id })
      .populate("software", "name type")
      .populate("assignedTo", "name email role ProfilePhoto")
      .populate("resolvedBy", "name role ProfilePhoto")
      .populate("replies.sentBy", "name role ProfilePhoto")
      .populate("replies.customerRef", "name")
    if (!ticket)
      return res.status(404).json({ success: false, message: "Ticket not found" })

    // Filter out internal replies
    const filtered = ticket.toObject()
    filtered.replies = filtered.replies.filter(r => !r.isInternal)

    res.json({ success: true, data: filtered })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const portalReplyTicket = async (req, res) => {
  try {
    const { message } = req.body
    if (!message?.trim())
      return res.status(400).json({ success: false, message: "Message is required" })

    const ticket = await SupportTickets.findOneAndUpdate(
      { _id: req.params.id, customer: req.customer.id },
      {
        $push: {
          replies: {
            message: message.trim(),
            isCustomerReply: true,
            customerRef: req.customer.id,
          },
        },
        // Re-open if resolved/closed
        $set: { status: "Open" },
      },
      { new: true }
    )
      .populate("replies.sentBy", "name role ProfilePhoto")
      .populate("replies.customerRef", "name")

    if (!ticket)
      return res.status(404).json({ success: false, message: "Ticket not found" })

    res.json({ success: true, data: ticket.replies[ticket.replies.length - 1] })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Team / Assigned Manager ────────────────────────────────────────────────

const portalTeam = async (req, res) => {
  try {
    const customer = await Customers.findById(req.customer.id)
      .populate("serviceUser", "name email phone role ProfilePhoto")
    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" })

    const team = []

    // Primary: the assigned Standard user (service manager)
    if (customer.serviceUser) {
      const sv = customer.serviceUser.toObject ? customer.serviceUser.toObject() : customer.serviceUser
      team.push({ ...sv, isPrimary: true })
    }

    // Include all active SuperAdmin and Admin users
    const serviceUserId = customer.serviceUser?._id?.toString()
    const adminUsers = await Users.find({ role: { $in: ["SuperAdmin", "Admin"] }, isActive: true })
      .select("name email phone role ProfilePhoto")
      .lean()
    for (const admin of adminUsers) {
      if (admin._id.toString() !== serviceUserId) {
        team.push(admin)
      }
    }

    res.json({ success: true, data: team })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Unread message count (lightweight polling target) ──────────────────────

const portalUnreadCount = async (req, res) => {
  try {
    const count = await PortalMessage.countDocuments({
      customer: req.customer.id,
      sender: "team",
      readByCustomer: false,
    })
    res.json({ success: true, unread: count })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Messages ───────────────────────────────────────────────────────────────

const portalMessages = async (req, res) => {
  try {
    const msgs = await PortalMessage.find({ customer: req.customer.id })
      .populate("teamUser", "name role ProfilePhoto")
      .sort({ createdAt: 1 })
    // Mark team messages as read
    await PortalMessage.updateMany(
      { customer: req.customer.id, sender: "team", readByCustomer: false },
      { readByCustomer: true }
    )
    res.json({ success: true, data: msgs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const portalSendMessage = async (req, res) => {
  try {
    const { text } = req.body
    if (!text?.trim())
      return res.status(400).json({ success: false, message: "Message text is required" })

    const msg = await PortalMessage.create({
      customer: req.customer.id,
      sender:   "customer",
      text:     text.trim(),
      readByTeam: false,
      readByCustomer: true,
    })
    res.status(201).json({ success: true, data: msg })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Admin: enable/disable portal access ───────────────────────────────────

const enablePortalAccess = async (req, res) => {
  try {
    const { password, enable } = req.body
    const update = { portalAccess: enable !== false }

    if (password) {
      const salt = await bcryptjs.genSalt(10)
      update.portalPassword = await bcryptjs.hash(password, salt)
    }

    const customer = await Customers.findByIdAndUpdate(req.params.id, update, { new: true })
      .select("-portalPassword")
    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" })

    // Send welcome email with credentials when portal access is being enabled with a password
    if (process.env.EMAIL_SEND_WELCOME === "true" && enable !== false && password && customer.email) {
      const loginUrl = `${process.env.FRONTEND_URL}/portal/login`
      sendPortalWelcomeEmail(customer.email, {
        customerName:  customer.name,
        portalPassword: password,
        loginUrl,
      }).catch(() => {})
    }

    res.json({ success: true, message: "Portal access updated", data: customer })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Customer: forgot portal password ─────────────────────────────────────

const portalForgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" })

    const customer = await Customers.findOne({ email: email.toLowerCase().trim() })
    // Always respond with same message to prevent email enumeration
    if (!customer || !customer.portalAccess) {
      return res.json({ success: true, message: "If your account exists, a reset link has been sent to your email." })
    }

    const rawToken = crypto.randomBytes(32).toString("hex")
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")

    customer.portalResetToken   = hashedToken
    customer.portalResetExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    await customer.save()

    const resetUrl = `${process.env.FRONTEND_URL}/portal/reset-password/${rawToken}`

    try {
      await sendPortalResetEmail(customer.email, { customerName: customer.name, resetUrl })
    } catch (emailErr) {
      console.error("[Portal] Failed to send reset email:", emailErr.message)
      // In dev, return the token so it can be tested without SMTP
      if (process.env.NODE_ENV !== "production") {
        return res.json({ success: true, message: "Email unavailable in dev — use this reset link", resetUrl, resetToken: rawToken })
      }
      return res.status(500).json({ success: false, message: "Could not send reset email. Please try again later." })
    }

    res.json({ success: true, message: "If your account exists, a reset link has been sent to your email." })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Customer: reset portal password with token ────────────────────────────

const portalResetPassword = async (req, res) => {
  try {
    const { password } = req.body
    if (!password || password.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" })

    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

    const customer = await Customers.findOne({
      portalResetToken:   hashedToken,
      portalResetExpires: { $gt: new Date() },
    })
    if (!customer)
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" })

    const salt = await bcryptjs.genSalt(10)
    customer.portalPassword      = await bcryptjs.hash(password, salt)
    customer.portalResetToken    = undefined
    customer.portalResetExpires  = undefined
    await customer.save()

    res.json({ success: true, message: "Password reset successful. You can now log in." })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Admin: reply to customer message ──────────────────────────────────────

const adminReplyPortalMessage = async (req, res) => {
  try {
    const { text } = req.body
    if (!text?.trim())
      return res.status(400).json({ success: false, message: "Message text is required" })

    const msg = await PortalMessage.create({
      customer: req.params.customerId,
      sender:   "team",
      teamUser: req.user.id,
      text:     text.trim(),
      readByTeam: true,
      readByCustomer: false,
    })
    const populated = await PortalMessage.findById(msg._id).populate("teamUser", "name role ProfilePhoto")

    createPortalNotification({
      customer: req.params.customerId,
      type:     "MessageReceived",
      title:    "New message from the team",
      message:  `You have a new message from ${populated.teamUser?.name || "the support team"}.`,
      link:     "/portal/messages",
    })

    res.status(201).json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Admin: view customer portal messages ──────────────────────────────────

const adminGetPortalMessages = async (req, res) => {
  try {
    const msgs = await PortalMessage.find({ customer: req.params.customerId })
      .populate("teamUser", "name role ProfilePhoto")
      .sort({ createdAt: 1 })
    await PortalMessage.updateMany(
      { customer: req.params.customerId, sender: "customer", readByTeam: false },
      { readByTeam: true }
    )
    res.json({ success: true, data: msgs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Customer: update own name and phone ───────────────────────────────────

const portalUpdateMe = async (req, res) => {
  try {
    const { name, phone, whatsapp, businessName, address = {} } = req.body
    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Name is required" })

    const update = {
      name: name.trim(),
      phone: (phone || "").trim(),
      whatsapp: (whatsapp || "").trim(),
      businessName: (businessName || "").trim(),
      address: {
        city: (address.city || "").trim(),
        state: (address.state || "").trim(),
        country: (address.country || "India").trim(),
      },
    }

    const customer = await Customers.findByIdAndUpdate(
      req.customer.id,
      update,
      { new: true, runValidators: true }
    ).select("-portalPassword -portalResetToken -portalResetExpires")

    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" })

    res.json({ success: true, message: "Profile updated successfully", data: customer })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Customer: change portal password ─────────────────────────────────────

const portalChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: "Current password and new password are required" })
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" })
    if (currentPassword === newPassword)
      return res.status(400).json({ success: false, message: "New password must differ from the current password" })

    const customer = await Customers.findById(req.customer.id)
    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" })

    const isMatch = await bcryptjs.compare(currentPassword, customer.portalPassword)
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Current password is incorrect" })

    const salt = await bcryptjs.genSalt(10)
    customer.portalPassword = await bcryptjs.hash(newPassword, salt)
    await customer.save()

    res.json({ success: true, message: "Password changed successfully" })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  portalLogin,
  portalLogout,
  portalMe,
  portalDashboard,
  portalSubscriptions,
  portalInvoices,
  portalSubmitPaymentReference,
  portalAlerts,
  portalTickets,
  portalCreateTicket,
  portalTicketDetail,
  portalReplyTicket,
  portalTeam,
  portalMessages,
  portalSendMessage,
  portalUnreadCount,
  enablePortalAccess,
  adminReplyPortalMessage,
  adminGetPortalMessages,
  portalForgotPassword,
  portalResetPassword,
  portalUpdateMe,
  portalChangePassword,
}
