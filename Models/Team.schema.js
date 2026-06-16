const mongoose = require("mongoose")

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    color: { type: String, default: "#1a73e8" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
)

const Team = mongoose.model("Team", TeamSchema)
module.exports = Team
