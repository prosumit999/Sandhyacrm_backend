const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const {
    getAllTasks,
    createTask,
    getTaskById,
    updateTask,
    deleteTask,
} = require("../Controllers/task.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllTasks)
router.post("/", checkroles("SuperAdmin", "Admin", "Standard"), createTask)
router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getTaskById)
router.put("/:id", checkroles("SuperAdmin", "Admin", "Standard"), updateTask)
router.delete("/:id", checkroles("SuperAdmin", "Admin"), deleteTask)

module.exports = router
