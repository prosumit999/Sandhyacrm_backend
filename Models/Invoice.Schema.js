const mongoose = require("mongoose")

const InvoiceSchema = mongoose.Schema(
  {
 
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,           // e.g. "INV-2025-0042"
    },

   
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customers",
      required: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscriptions",
      required: true,
    },
    software: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Softwares",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,          
    },
    totalAmount: {
      type: Number,
      required: true,      
    },
    discount: {
      type: Number,
      default: 0,
    },

    
    invoiceType: {
      type: String,
      enum: ["NewPurchase", "Renewal", "Upgrade", "Refund"],
      default: "NewPurchase",
    },


    periodFrom: {
      type: Date,
      required: true,
    },
    periodTo: {
      type: Date,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Overdue", "Cancelled", "Refunded"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "UPI", "BankTransfer", "Cheque", "Card", "Other"],
    },
    paymentDate: {
      type: Date,           // date payment was received
    },
    transactionId: {
      type: String,         // UPI ref, bank UTR, etc.
      trim: true,
    },
    customerPaymentReference: {
      type: String,
      trim: true,
    },
    customerPaymentNote: {
      type: String,
      trim: true,
    },
    customerPaymentSubmittedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  { timestamps: true }
)

// Index for fast lookups by customer and payment status
InvoiceSchema.index({ customer: 1, paymentStatus: 1 })

const Invoices = mongoose.model("Invoices", InvoiceSchema)
module.exports = Invoices
