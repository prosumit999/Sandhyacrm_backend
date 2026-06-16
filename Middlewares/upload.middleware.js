const multer = require("multer");
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const MAX_FILE_SIZE = 5 * 1024 * 1024  // 5MB

// Files are stored in memory as Buffer, then streamed to Cloudinary by the controller
const storage = multer ? multer.memoryStorage() : null

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error("File type not allowed. Only images (jpg, png, webp) and documents (pdf, doc, docx) are accepted."), false)
    }
}

const upload = multer
    ? multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } })
    : null

// Single file upload (e.g. profile photo)
const uploadSingle = (fieldName) => {
    if (!upload) return (req, res, next) => res.status(500).json({ success: false, message: "File upload not available. Install multer." })
    return upload.single(fieldName)
}

// Multiple files upload — max 5 files (e.g. customer documents)
const uploadMultiple = (fieldName, max = 5) => {
    if (!upload) return (req, res, next) => res.status(500).json({ success: false, message: "File upload not available. Install multer." })
    return upload.array(fieldName, max)
}

module.exports = { uploadSingle, uploadMultiple }
