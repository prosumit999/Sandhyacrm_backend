const Tags = require("../Models/Tag.schema")
const Customers = require("../Models/Customer.model")
const Softwares = require("../Models/Softwares.schema")
const { getPaginationParams, buildPaginationMeta } = require("../Utils/pagination.util")

const getAllTags = async (req, res) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query)
        const { search, appliesTo } = req.query
        const query = {}
        if (appliesTo) query.appliesTo = appliesTo
        if (search) query.name = { $regex: search, $options: "i" }

        const [tags, total] = await Promise.all([
            Tags.find(query).populate("createdBy", "name").sort({ name: 1 }).skip(skip).limit(limit),
            Tags.countDocuments(query),
        ])

        res.status(200).json({ success: true, message: "Tags fetched", data: tags, pagination: buildPaginationMeta(total, page, limit) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const createTag = async (req, res) => {
    try {
        const { name, color, appliesTo } = req.body
        if (!name) return res.status(400).json({ success: false, message: "name is required" })

        const tag = new Tags({ name: name.toLowerCase().trim(), color, appliesTo, createdBy: req.user.id })
        await tag.save()
        res.status(201).json({ success: true, message: "Tag created", data: tag })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: "Tag name already exists" })
        res.status(500).json({ success: false, message: err.message })
    }
}

const getTagById = async (req, res) => {
    try {
        const tag = await Tags.findById(req.params.id).populate("createdBy", "name email")
        if (!tag) return res.status(404).json({ success: false, message: "Tag not found" })
        res.status(200).json({ success: true, message: "Tag fetched", data: tag })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

const updateTag = async (req, res) => {
    try {
        const { name, color, appliesTo } = req.body
        const update = {}
        if (name) update.name = name.toLowerCase().trim()
        if (color) update.color = color
        if (appliesTo) update.appliesTo = appliesTo

        const tag = await Tags.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
        if (!tag) return res.status(404).json({ success: false, message: "Tag not found" })
        res.status(200).json({ success: true, message: "Tag updated", data: tag })
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: "Tag name already exists" })
        res.status(500).json({ success: false, message: err.message })
    }
}

// Block delete if any Customer or Software still references this tag
const deleteTag = async (req, res) => {
    try {
        const [customerCount, softwareCount] = await Promise.all([
            Customers.countDocuments({ tags: req.params.id }),
            Softwares.countDocuments({ tags: req.params.id }),
        ])
        if (customerCount + softwareCount > 0) {
            return res.status(400).json({ success: false, message: `Tag is in use by ${customerCount + softwareCount} records and cannot be deleted` })
        }

        const tag = await Tags.findByIdAndDelete(req.params.id)
        if (!tag) return res.status(404).json({ success: false, message: "Tag not found" })
        res.status(200).json({ success: true, message: "Tag deleted" })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = { getAllTags, createTag, getTagById, updateTag, deleteTag }
