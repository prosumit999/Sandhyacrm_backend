const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "invoice", "subscription", "alert"],
      default: "text",
    },
    refId:   { type: mongoose.Schema.Types.ObjectId },
    refData: { type: mongoose.Schema.Types.Mixed },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model("Message", MessageSchema)
