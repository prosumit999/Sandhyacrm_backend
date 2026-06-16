const mongoose = require("mongoose")

const TagSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        // Hex color code for UI badge display
        color: {
            type: String,
            default: "#6366f1",
            trim: true,
        },
        appliesTo: {
            type: String,
            enum: ["Customer", "Software", "Both"],
            default: "Both",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
    },
    { timestamps: true }
)

const Tags = mongoose.model("Tags", TagSchema)
module.exports = Tags
