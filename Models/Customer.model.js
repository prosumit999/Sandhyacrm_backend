const mongoose = require("mongoose")
const CustomerSchema = mongoose.Schema({
    name:{
        required: true, 
        type: String, 
        trim: true, 
    },
    email:{
        required: true, 
        type: String, 
        lowercase: true, 
        trim: true, 
        unique: true,
    }, 
    phone:{
        type: String, 
        required: true, 
        trim: true, 
    }, 
    whatsapp:{
        type: String, 
        trim: true
    }, 
    businessName:{
        type: String, 
        trim: true,
    }, 
    Appurl:{
        type: String,
        trim: true, 
    },
    address:{
        city:{type: String, trim: true,}, 
        state:{type: String, trim: true},
        country:{type: String, trim: true, default: "India"}
    }, 
    status:{
        type: String, 
        enum: ["Active", "Expired", "Suspended", "Lead"],
        default: "Active",
    },
    referrredBy:{
    type: String,         
      trim: true,
    },
     notes: {
      type: String,
      trim: true,
    },
     documents: {
      type: [String],        // array of file URLs / paths (agreements, POs)
      default: [],
    },
    Subscriptions:{
        required: true,
        type: String, 
        enum: [
            "Desktop", 
            "Web Application", 
            "Mobile Application"
        ] 
    },
    serviceUser:{
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    },

    // Customer portal access
    portalAccess:   { type: Boolean, default: false },
    portalPassword: { type: String },                    // bcrypt hashed
})

const Customers = mongoose.model("Customers", CustomerSchema)
module.exports = Customers