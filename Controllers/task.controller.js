const Tasks = require("../Models/Task.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

const populatedTask = [
    { path: "software", select: "name type status" },
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
]

const getAllTasks = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { status, priority, type, assignedTo, software, search, mine } = req.query
        const query = {}

        if (status) query.status = status
        if (priority) query.priority = priority
        if (type) query.type = type
        if (assignedTo) query.assignedTo = assignedTo
        if (software) query.software = software
        if (mine === "true") query.assignedTo = req.user.id
        if (search) query.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
        ]

        const [tasks, total] = await Promise.all([
            Tasks.find(query)
                .populate(populatedTask)
                .sort({ status: 1, dueDate: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Tasks.countDocuments(query),
        ])

        res.status(200).json({
            success: true,
            message: "Tasks fetched",
            data: tasks,
            pagination: buildPaginationMeta(total, page, limit),
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createTask = async (req, res) => {
    try {
        const { title } = req.body
        if (!title) return res.status(400).json({ success: false, message: "title is required" })

        const task = new Tasks({ ...req.body, createdBy: req.user.id })
        if (task.status === "Done" && !task.completedAt) task.completedAt = new Date()
        await task.save()
        await task.populate(populatedTask)

        res.status(201).json({ success: true, message: "Task created", data: task })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const getTaskById = async (req, res) => {
    try {
        const task = await Tasks.findById(req.params.id).populate(populatedTask)
        if (!task) return res.status(404).json({ success: false, message: "Task not found" })
        res.status(200).json({ success: true, message: "Task fetched", data: task })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateTask = async (req, res) => {
    try {
        const { createdBy, completedAt, ...safeFields } = req.body
        if (safeFields.status === "Done") safeFields.completedAt = new Date()
        if (safeFields.status && safeFields.status !== "Done") safeFields.completedAt = null

        const task = await Tasks.findByIdAndUpdate(req.params.id, safeFields, { new: true, runValidators: true })
            .populate(populatedTask)
        if (!task) return res.status(404).json({ success: false, message: "Task not found" })

        res.status(200).json({ success: true, message: "Task updated", data: task })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const deleteTask = async (req, res) => {
    try {
        const task = await Tasks.findByIdAndDelete(req.params.id)
        if (!task) return res.status(404).json({ success: false, message: "Task not found" })
        res.status(200).json({ success: true, message: "Task deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getAllTasks,
    createTask,
    getTaskById,
    updateTask,
    deleteTask,
}
