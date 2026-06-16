const express = require("express")
const router = express.Router()
const DashboardInfo = require("../Controllers/superadmin.controller")

router.get("/DashboardInfo", DashboardInfo)

module.exports = router;