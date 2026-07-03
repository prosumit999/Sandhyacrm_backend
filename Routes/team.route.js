const express    = require("express")
const router     = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllTeams, createTeam, updateTeam, deleteTeam,
    addMember, removeMember,
} = require("../Controllers/team.controller")

const adminOnly = checkroles("SuperAdmin", "Admin")

router.get("/",                          adminOnly, getAllTeams)
router.post("/",                         adminOnly, createTeam)
router.put("/:id",                       adminOnly, updateTeam)
router.delete("/:id",                    adminOnly, deleteTeam)
router.post("/:id/members",              adminOnly, addMember)
router.delete("/:id/members/:userId",    adminOnly, removeMember)

module.exports = router
