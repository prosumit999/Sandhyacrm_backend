const Settings = require("../Models/Settings.schema")
const { writeAuditLog, computeChangedFields } = require("../Services/auditlog.service")

const ALLOWED_FIELDS = [
  'orgName', 'orgTagline', 'gstin', 'pan', 'cin',
  'address', 'city', 'state', 'pincode',
  'phone', 'email',
  'bankName', 'bankAccount', 'bankIfsc', 'bankBranch',
  'emailBrandColor', 'emailAlertColor', 'emailFooterPhone',
]

// GET /api/v1/settings  — all authenticated roles
const getInvoiceSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne()
    if (!settings) settings = await Settings.create({})
    res.status(200).json({ success: true, data: settings })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// PUT /api/v1/settings  — SuperAdmin, Admin only
const updateInvoiceSettings = async (req, res) => {
  try {
    const update = {}
    ALLOWED_FIELDS.forEach(k => {
      if (req.body[k] !== undefined) update[k] = req.body[k]
    })

    // Capture current state before overwriting for before/after snapshot
    const oldSettings = await Settings.findOne().lean()

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    const changedFields = computeChangedFields(oldSettings, settings.toObject())
    if (changedFields.length > 0) {
      writeAuditLog({
        performedBy:  req.user.id,
        category:     "System",
        action:       "ConfigChanged",
        targetModel:  "Settings",
        targetId:     settings._id,
        targetLabel:  "Invoice Settings",
        changedFields,
        before:       oldSettings,
        after:        settings.toObject(),
        severity:     "warning",
        metadata:     { changedCount: changedFields.length },
        ipAddress:    req.ip,
      }).catch(() => {})
    }

    res.status(200).json({ success: true, data: settings, message: 'Invoice settings saved.' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getInvoiceSettings, updateInvoiceSettings }
