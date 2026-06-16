const Conversation = require("../Models/Conversation.schema")
const Message      = require("../Models/Message.schema")
const Users        = require("../Models/user.schema")
const Invoice      = require("../Models/Invoice.Schema")
const Subscription = require("../Models/Subscription.Schema")
const Alert        = require("../Models/Alert.Schema")

// Populate helper for conversations
const populateConv = (q) =>
  q
    .populate("participants", "name email role ProfilePhoto isActive")
    .populate("createdBy", "name")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "name" },
    })

// GET /chat/users — all active users except self (for starting new chat)
const getChatUsers = async (req, res) => {
  try {
    const users = await Users.find({ _id: { $ne: req.user.id }, isActive: true })
      .select("name email role ProfilePhoto")
      .sort({ name: 1 })
    res.json({ success: true, data: users })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /chat/conversations — all conversations the user is part of, with unread counts
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id

    const conversations = await populateConv(
      Conversation.find({ participants: userId }).sort({ updatedAt: -1 })
    )

    const result = conversations.map((conv) => {
      const plain = conv.toObject()
      plain.unreadCount = conv.unreadCounts?.get?.(userId) || 0
      delete plain.unreadCounts
      return plain
    })

    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// POST /chat/conversations — create DM (dedup) or group
const createConversation = async (req, res) => {
  try {
    const { type, participantIds, name } = req.body
    const userId = req.user.id

    if (!type || !participantIds?.length) {
      return res.status(400).json({ success: false, message: "type and participantIds are required" })
    }

    const allParticipants = [...new Set([userId, ...participantIds])]

    if (type === "direct") {
      if (allParticipants.length !== 2) {
        return res.status(400).json({ success: false, message: "Direct conversation requires exactly 2 participants" })
      }
      // Dedup: find existing direct conversation between these two users
      const existing = await Conversation.findOne({
        type: "direct",
        participants: { $all: allParticipants, $size: 2 },
      })
      if (existing) {
        const populated = await populateConv(Conversation.findById(existing._id))
        const plain = populated.toObject()
        plain.unreadCount = existing.unreadCounts?.get?.(userId) || 0
        delete plain.unreadCounts
        return res.json({ success: true, data: plain, existing: true })
      }
    }

    if (type === "group" && !name?.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" })
    }

    const conv = await Conversation.create({
      type,
      name: type === "group" ? name.trim() : undefined,
      participants: allParticipants,
      createdBy: userId,
    })

    const populated = await populateConv(Conversation.findById(conv._id))
    const plain = populated.toObject()
    plain.unreadCount = 0
    delete plain.unreadCounts

    res.status(201).json({ success: true, data: plain })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /chat/admin/conversations — all conversations (admin only)
const getAllConversations = async (req, res) => {
  try {
    const conversations = await populateConv(
      Conversation.find({}).sort({ updatedAt: -1 })
    )
    res.json({ success: true, data: conversations })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /chat/conversations/:id/messages — paginated messages, newest-last
const getMessages = async (req, res) => {
  try {
    const { id } = req.params
    const { before, limit = 40 } = req.query
    const userId  = req.user.id
    const isAdmin = ["SuperAdmin", "Admin"].includes(req.user.role)

    // Admins can see any conversation; others must be a participant
    const conv = await Conversation.findOne(
      isAdmin ? { _id: id } : { _id: id, participants: userId }
    )
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" })

    const query = { conversation: id, deleted: false }
    if (before) query._id = { $lt: before }

    const messages = await Message.find(query)
      .populate("sender", "name email role ProfilePhoto")
      .sort({ _id: -1 })
      .limit(Number(limit))

    // Return in chronological order
    messages.reverse()

    // Mark messages as read — clear unread count for this user
    await Conversation.findByIdAndUpdate(id, {
      $unset: { [`unreadCounts.${userId}`]: "" },
    })

    res.json({ success: true, data: messages, hasMore: messages.length === Number(limit) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ── Share search endpoints ─────────────────────────────────────────────────

const searchShareInvoices = async (req, res) => {
  try {
    const { q } = req.query
    const query = q ? { invoiceNumber: new RegExp(q, "i") } : {}
    const docs = await Invoice.find(query)
      .populate("customer", "name businessName phone email")
      .populate("software",  "name type")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(15)
    res.json({ success: true, data: docs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const searchShareSubscriptions = async (req, res) => {
  try {
    const { q } = req.query
    const query = q ? {} : {}
    const docs = await Subscription.find(query)
      .populate("customer",  "name businessName phone email")
      .populate("softwares", "name type")
      .populate("createdBy", "name")
      .sort({ renewalDate: 1 })
      .limit(15)
    res.json({ success: true, data: docs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

const searchShareAlerts = async (req, res) => {
  try {
    const { q } = req.query
    const query = q ? { title: new RegExp(q, "i") } : {}
    const docs = await Alert.find(query)
      .populate("customer",     "name businessName phone")
      .populate("software",     "name type")
      .populate("subscription", "amountCharged renewalDate status")
      .sort({ dueDate: 1 })
      .limit(15)
    res.json({ success: true, data: docs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  getChatUsers,
  getConversations,
  getAllConversations,
  createConversation,
  getMessages,
  searchShareInvoices,
  searchShareSubscriptions,
  searchShareAlerts,
}
