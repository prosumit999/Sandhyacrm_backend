const mongoose = require("mongoose")
const SubscriptionsSchema = mongoose.Schema({
    customer:{
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Customers", 
        required: true, 
    },
    softwares:{
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Softwares",
        required: true, 
    },
     buyDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    renewalDate: {
      type: Date,
      required: true,     // set by admin at time of purcahse
    },
    lastRenewedDate: {
      type: Date,         // updated every time customer renews
    },
    amountCharged: {
      type: Number,
      required: true,
    },
     billingCycle: {
      type: String,
      enum: ["Monthly", "Quarterly", "HalfYearly", "Yearly", "OneTime"],
      default: "Yearly",
    },
      paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Overdue", "Waived"],
      default: "Paid",
    },
     status: {
      type: String,
      enum: ["Active", "Expired", "Cancelled", "Paused"],
      default: "Active",
    },
     reminderSent: {
      thirtyDays: { type: Boolean, default: false },
      sevenDays:  { type: Boolean, default: false },
      oneDay:     { type: Boolean, default: false },
      overdue:    { type: Boolean, default: false },
    },
 
    // ─── Notes ───────────────────────────────────────────────────────────────
    notes: {
      type: String,
      trim: true,
    },
 
    // ─── Managed By ──────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  { timestamps: true }
)
 
// Compound index: one customer can only have one active subscription per software
SubscriptionsSchema.index({ customer: 1, softwares: 1 }, { unique: true })

const Subscriptions = mongoose.model("Subscriptions", SubscriptionsSchema)
module.exports = Subscriptions