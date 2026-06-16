const axios = require("axios")
const Communications = require("../Models/Communication.schema")

const MSG91_BASE = "https://api.msg91.com/api/v2"

// Send a plain SMS via MSG91 and log the result to Communications
const sendSMS = async ({ customerId, phone, message, templateId, sentBy = null, purpose = "General", relatedAlert = null }) => {
    const result = { success: false, providerMessageId: null, error: null }

    try {
        const payload = {
            sender: process.env.MSG91_SENDER_ID,
            route: "4",           // 4 = transactional
            country: "91",
            sms: [{ message, to: [phone] }],
        }

        const response = await axios.post(`${MSG91_BASE}/sendsms`, payload, {
            headers: {
                "authkey": process.env.MSG91_AUTH_KEY,
                "Content-Type": "application/json",
            },
        })

        result.success = true
        result.providerMessageId = response.data?.request_id || null
    } catch (err) {
        result.error = err.message
    }

    // Always log the attempt to Communications — success or fail
    try {
        await Communications.create({
            customer: customerId,
            channel: "SMS",
            direction: "Outbound",
            purpose,
            message,
            phone,
            deliveryStatus: result.success ? "Sent" : "Failed",
            providerMessageId: result.providerMessageId,
            providerResponse: result.error,
            relatedAlert,
            sentBy,
        })
    } catch (_) {}

    return result
}

// Send WhatsApp message via MSG91 WhatsApp Business API
const sendWhatsApp = async ({ customerId, phone, message, templateId, sentBy = null, purpose = "General", relatedAlert = null }) => {
    const result = { success: false, providerMessageId: null, error: null }

    try {
        const payload = {
            integrated_number: process.env.WHATSAPP_PHONE_ID,
            content_type: "template",
            payload: {
                to: `91${phone}`,
                type: "template",
                template: {
                    name: templateId || "general_message",
                    language: { code: "en" },
                    components: [{ type: "body", parameters: [{ type: "text", text: message }] }],
                },
            },
        }

        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                "authkey": process.env.MSG91_AUTH_KEY,
                "Content-Type": "application/json",
            },
        })

        result.success = true
        result.providerMessageId = response.data?.data?.message_id || null
    } catch (err) {
        result.error = err.message
    }

    try {
        await Communications.create({
            customer: customerId,
            channel: "WhatsApp",
            direction: "Outbound",
            purpose,
            message,
            phone,
            deliveryStatus: result.success ? "Sent" : "Failed",
            providerMessageId: result.providerMessageId,
            providerResponse: result.error,
            relatedAlert,
            sentBy,
        })
    } catch (_) {}

    return result
}

module.exports = { sendSMS, sendWhatsApp }
