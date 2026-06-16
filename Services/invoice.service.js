const PDFDocument = require("pdfkit")
const cloudinary = require("cloudinary").v2
const { Readable } = require("stream")

// Configure Cloudinary once — reads from .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Build a PDF buffer for an invoice — returns a Promise<Buffer>
const generateInvoicePDF = (invoice) =>
    new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 })
        const chunks = []

        doc.on("data", (chunk) => chunks.push(chunk))
        doc.on("end", () => resolve(Buffer.concat(chunks)))
        doc.on("error", reject)

        // Header
        doc.fontSize(20).font("Helvetica-Bold").text(process.env.COMPANY_NAME || "Company", 50, 50)
        doc.fontSize(10).font("Helvetica").fillColor("#666").text(process.env.COMPANY_ADDRESS || "", 50, 75)
        doc.text(`GST: ${process.env.COMPANY_GST || ""}`, 50, 88)
        doc.fillColor("#000")

        // Invoice label
        doc.fontSize(24).font("Helvetica-Bold").fillColor("#4f46e5").text("INVOICE", 400, 50, { align: "right" })
        doc.fontSize(10).font("Helvetica").fillColor("#000")
        doc.text(`Invoice #: ${invoice.invoiceNumber}`, 400, 85, { align: "right" })
        doc.text(`Date: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString("en-IN")}`, 400, 98, { align: "right" })

        // Divider
        doc.moveTo(50, 120).lineTo(545, 120).strokeColor("#e5e7eb").stroke()

        // Bill to
        doc.fontSize(10).font("Helvetica-Bold").text("BILL TO:", 50, 135)
        doc.font("Helvetica").text(invoice.customer?.name || "", 50, 150)
        doc.text(invoice.customer?.email || "", 50, 163)
        doc.text(invoice.customer?.phone || "", 50, 176)

        // Period
        doc.font("Helvetica-Bold").text("SERVICE PERIOD:", 350, 135)
        doc.font("Helvetica").text(`${new Date(invoice.periodFrom).toLocaleDateString("en-IN")} — ${new Date(invoice.periodTo).toLocaleDateString("en-IN")}`, 350, 150)

        // Table header
        doc.moveTo(50, 205).lineTo(545, 205).strokeColor("#e5e7eb").stroke()
        doc.fontSize(10).font("Helvetica-Bold")
        doc.text("Description", 50, 215)
        doc.text("Amount", 450, 215, { align: "right", width: 95 })
        doc.moveTo(50, 230).lineTo(545, 230).strokeColor("#e5e7eb").stroke()

        // Row
        doc.font("Helvetica").fontSize(10)
        doc.text(invoice.software?.name || "Software Service", 50, 245)
        doc.text(`₹${invoice.amount?.toLocaleString("en-IN") || 0}`, 450, 245, { align: "right", width: 95 })

        // Totals
        doc.moveTo(350, 280).lineTo(545, 280).strokeColor("#e5e7eb").stroke()
        doc.text("Subtotal:", 350, 290)
        doc.text(`₹${invoice.amount?.toLocaleString("en-IN") || 0}`, 450, 290, { align: "right", width: 95 })
        if (invoice.tax) {
            doc.text("Tax:", 350, 305)
            doc.text(`₹${invoice.tax?.toLocaleString("en-IN") || 0}`, 450, 305, { align: "right", width: 95 })
        }
        if (invoice.discount) {
            doc.text("Discount:", 350, 320)
            doc.text(`- ₹${invoice.discount?.toLocaleString("en-IN") || 0}`, 450, 320, { align: "right", width: 95 })
        }
        doc.moveTo(350, 335).lineTo(545, 335).strokeColor("#4f46e5").stroke()
        doc.font("Helvetica-Bold").fontSize(12)
        doc.text("TOTAL:", 350, 345)
        doc.fillColor("#4f46e5").text(`₹${invoice.totalAmount?.toLocaleString("en-IN") || 0}`, 450, 345, { align: "right", width: 95 })

        // Footer
        doc.fillColor("#666").fontSize(9).font("Helvetica")
        doc.text("Thank you for your business.", 50, 700, { align: "center", width: 495 })
        doc.text(`${process.env.COMPANY_NAME} | ${process.env.COMPANY_EMAIL || ""} | ${process.env.COMPANY_PHONE || ""}`, 50, 715, { align: "center", width: 495 })

        doc.end()
    })

// Upload a PDF buffer to Cloudinary — returns the secure URL
const uploadInvoicePDF = (buffer, invoiceNumber) =>
    new Promise((resolve, reject) => {
        const folder = process.env.CLOUDINARY_INVOICE_FOLDER || "sandhya-crm/invoices"
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, public_id: invoiceNumber, resource_type: "raw", format: "pdf" },
            (err, result) => {
                if (err) return reject(err)
                resolve(result.secure_url)
            }
        )
        Readable.from(buffer).pipe(uploadStream)
    })

module.exports = { generateInvoicePDF, uploadInvoicePDF }
