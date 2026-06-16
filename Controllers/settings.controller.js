const Settings = require("../Models/Settings.schema")

const ALLOWED_FIELDS = [
  'orgName', 'orgTagline', 'gstin', 'pan', 'cin',
  'address', 'city', 'state', 'pincode',
  'phone', 'email',
  'bankName', 'bankAccount', 'bankIfsc', 'bankBranch',
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

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    res.status(200).json({ success: true, data: settings, message: 'Invoice settings saved.' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getInvoiceSettings, updateInvoiceSettings }
