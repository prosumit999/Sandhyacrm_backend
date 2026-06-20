const mongoose = require("mongoose")

// Singleton — only one document ever exists; use findOne / findOneAndUpdate
const SettingsSchema = mongoose.Schema(
  {
    // Organisation identity
    orgName:    { type: String, default: '', trim: true },
    orgTagline: { type: String, default: '', trim: true },
    gstin:      { type: String, default: '', trim: true },
    pan:        { type: String, default: '', trim: true },
    cin:        { type: String, default: '', trim: true },

    // Address
    address:    { type: String, default: '', trim: true },
    city:       { type: String, default: '', trim: true },
    state:      { type: String, default: '', trim: true },
    pincode:    { type: String, default: '', trim: true },

    // Contact
    phone:      { type: String, default: '', trim: true },
    email:      { type: String, default: '', trim: true },

    // Bank details (optional, shown on receipt)
    bankName:    { type: String, default: '', trim: true },
    bankAccount: { type: String, default: '', trim: true },
    bankIfsc:    { type: String, default: '', trim: true },
    bankBranch:  { type: String, default: '', trim: true },

    // Email branding
    emailBrandColor: { type: String, default: '#1a73e8', trim: true },
    emailAlertColor: { type: String, default: '#f59e0b', trim: true },
    emailFooterPhone: { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

const Settings = mongoose.model("Settings", SettingsSchema)
module.exports = Settings
