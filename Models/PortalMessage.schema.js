const mongoose = require("mongoose")

const PortalMessageSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customers",
      required: true,
      index: true,
    },
    sender: {
      type: String,
      enum: ["customer", "team"],
      required: true,
    },
    teamUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    readByTeam:     { type: Boolean, default: false },
    readByCustomer: { type: Boolean, default: true  },
  },
  { timestamps: true }
)

module.exports = mongoose.model("PortalMessage", PortalMessageSchema)
