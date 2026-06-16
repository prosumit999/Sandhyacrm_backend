const jwt = require("jsonwebtoken")

const verifyPortalCustomer = (req, res, next) => {
  try {
    const token = req.cookies.portaltoken
    if (!token) {
      return res.status(401).json({ success: false, message: "Portal login required" })
    }
    const decoded = jwt.verify(token, process.env.JWT_SEC)
    req.customer = decoded   // { id, email, name }
    next()
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired portal session" })
  }
}

module.exports = verifyPortalCustomer
