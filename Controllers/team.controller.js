const Team = require("../Models/Team.schema")

const populate = q => q.populate("members", "name email role ProfilePhoto isActive").populate("createdBy", "name")

const getAllTeams = async (req, res) => {
    try {
        const teams = await populate(Team.find().sort({ createdAt: -1 }))
        res.status(200).json({ success: true, data: teams })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createTeam = async (req, res) => {
    try {
        const { name, description, color } = req.body
        if (!name?.trim()) return res.status(400).json({ success: false, message: "Team name is required" })
        const team = await Team.create({ name: name.trim(), description, color, createdBy: req.user._id })
        await populate(Team.findById(team._id)).then(t => {
            res.status(201).json({ success: true, message: "Team created", data: t })
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateTeam = async (req, res) => {
    try {
        const { name, description, color } = req.body
        if (name !== undefined && !name?.trim()) return res.status(400).json({ success: false, message: "Team name cannot be empty" })
        const update = {}
        if (name)        update.name        = name.trim()
        if (description !== undefined) update.description = description
        if (color)       update.color       = color
        const team = await populate(Team.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }))
        if (!team) return res.status(404).json({ success: false, message: "Team not found" })
        res.status(200).json({ success: true, message: "Team updated", data: team })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const deleteTeam = async (req, res) => {
    try {
        const team = await Team.findByIdAndDelete(req.params.id)
        if (!team) return res.status(404).json({ success: false, message: "Team not found" })
        res.status(200).json({ success: true, message: "Team deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const addMember = async (req, res) => {
    try {
        const { userId } = req.body
        if (!userId) return res.status(400).json({ success: false, message: "userId is required" })
        const team = await populate(
            Team.findByIdAndUpdate(req.params.id, { $addToSet: { members: userId } }, { new: true })
        )
        if (!team) return res.status(404).json({ success: false, message: "Team not found" })
        res.status(200).json({ success: true, message: "Member added", data: team })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const removeMember = async (req, res) => {
    try {
        const team = await populate(
            Team.findByIdAndUpdate(req.params.id, { $pull: { members: req.params.userId } }, { new: true })
        )
        if (!team) return res.status(404).json({ success: false, message: "Team not found" })
        res.status(200).json({ success: true, message: "Member removed", data: team })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getAllTeams, createTeam, updateTeam, deleteTeam, addMember, removeMember }
