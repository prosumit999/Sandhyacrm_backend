const jwt     = require("jsonwebtoken")
const cookie  = require("cookie")
const Conversation = require("../Models/Conversation.schema")
const Message      = require("../Models/Message.schema")

// userId -> Set of socketIds (one user can have multiple tabs)
const onlineUsers = new Map()

module.exports = function initChatSocket(io) {

  // Auth middleware — reads logintoken from cookie header
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || ""
      const cookies = cookie.parse(raw)
      const token = cookies.logintoken
      if (!token) return next(new Error("Unauthenticated"))
      const user = jwt.verify(token, process.env.JWT_SEC)
      socket.user = user   // { id, email, role }
      next()
    } catch {
      next(new Error("Invalid token"))
    }
  })

  io.on("connection", async (socket) => {
    const userId = socket.user.id

    // Track online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
    onlineUsers.get(userId).add(socket.id)

    // Auto-join all of this user's conversation rooms
    const convs = await Conversation.find({ participants: userId }, "_id")
    convs.forEach(c => socket.join(c._id.toString()))

    // Broadcast updated online list
    io.emit("online_users", [...onlineUsers.keys()])

    // ── send_message ──────────────────────────────────────────────────────
    socket.on("send_message", async (data) => {
      try {
        const { conversationId, text } = data || {}
        if (!conversationId) return
        if (!text?.trim() && !data?.refId) return

        const conv = await Conversation.findOne({ _id: conversationId, participants: userId })
        if (!conv) return

        const { type = 'text', refId, refData } = data || {}

        const msg = await Message.create({
          conversation: conversationId,
          sender: userId,
          text: text?.trim() || '',
          type,
          refId:   refId   || undefined,
          refData: refData  || undefined,
          readBy: [userId],
        })

        const populated = await Message.findById(msg._id)
          .populate("sender", "name email role ProfilePhoto")

        // Increment unread for all other participants
        const others = conv.participants.filter(p => p.toString() !== userId)
        const unreadUpdate = {}
        for (const pid of others) {
          const key = `unreadCounts.${pid}`
          unreadUpdate[key] = (conv.unreadCounts?.get?.(pid.toString()) || 0) + 1
        }

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: msg._id,
          updatedAt: new Date(),
          $set: unreadUpdate,
        })

        // Emit to everyone in the room (including sender)
        io.to(conversationId).emit("new_message", {
          conversationId,
          message: populated,
        })

        // Also push updated conversation to participants who are online but not in room yet
        const updatedConv = await Conversation.findById(conversationId)
          .populate("participants", "name email role ProfilePhoto isActive")
          .populate("createdBy", "name")
          .populate({ path: "lastMessage", populate: { path: "sender", select: "name" } })

        for (const pid of others) {
          const pidStr = pid.toString()
          const unreadCount = (conv.unreadCounts?.get?.(pidStr) || 0) + 1
          const plain = updatedConv.toObject()
          plain.unreadCount = unreadCount
          delete plain.unreadCounts
          io.to(conversationId).emit("conversation_updated", plain)
        }

      } catch (err) {
        socket.emit("error", { message: err.message })
      }
    })

    // ── typing indicators ─────────────────────────────────────────────────
    socket.on("typing_start", ({ conversationId }) => {
      socket.to(conversationId).emit("user_typing", { userId, conversationId })
    })

    socket.on("typing_stop", ({ conversationId }) => {
      socket.to(conversationId).emit("user_stopped_typing", { userId, conversationId })
    })

    // ── mark_read ─────────────────────────────────────────────────────────
    socket.on("mark_read", async ({ conversationId }) => {
      try {
        await Conversation.findByIdAndUpdate(conversationId, {
          $unset: { [`unreadCounts.${userId}`]: "" },
        })
        await Message.updateMany(
          { conversation: conversationId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        )
        socket.to(conversationId).emit("messages_read", { conversationId, userId })
      } catch (err) {
        // non-critical
      }
    })

    // ── join new conversation room (after creating a new group/DM) ────────
    socket.on("join_conversation", ({ conversationId }) => {
      socket.join(conversationId)
    })

    // ── disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) onlineUsers.delete(userId)
      }
      io.emit("online_users", [...onlineUsers.keys()])
    })
  })
}
