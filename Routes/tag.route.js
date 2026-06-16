const express = require("express")
const router = express.Router()
const checkroles = require("../Middlewares/role.permissions")
const { getAllTags, createTag, getTagById, updateTag, deleteTag } = require("../Controllers/tag.controller")

router.get("/", checkroles("SuperAdmin", "Admin", "Standard"), getAllTags)
router.post("/", checkroles("SuperAdmin", "Admin"), createTag)

router.get("/:id", checkroles("SuperAdmin", "Admin", "Standard"), getTagById)
router.put("/:id", checkroles("SuperAdmin", "Admin"), updateTag)
router.delete("/:id", checkroles("SuperAdmin"), deleteTag)

module.exports = router
