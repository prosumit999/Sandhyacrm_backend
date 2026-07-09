const mongoose = require("mongoose")

const TaskSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Task", "Bug", "Feature", "Improvement"],
      default: "Task",
    },
    status: {
      type: String,
      enum: ["Todo", "InProgress", "Blocked", "Done", "Cancelled"],
      default: "Todo",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    software: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Softwares",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

const Tasks = mongoose.model("Tasks", TaskSchema)
module.exports = Tasks
