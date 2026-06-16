const users = require("../Models/user.schema")

const DashboardInfo = async (req, res) => {
    try {
        const [GetAllAdmins, NumberOfAdmins] = await Promise.all([
            users.find({ role: "Admin" }),
            users.countDocuments({ role: "Admin" }),
        ])

        res.status(200).json({
            success: true,
            admins: GetAllAdmins,
            numberOfAdmins: NumberOfAdmins,
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        })
    }
}

module.exports = DashboardInfo