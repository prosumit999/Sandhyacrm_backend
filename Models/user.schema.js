const mongoose  = require("mongoose")
const userSchema = mongoose.Schema({
    name:{
        type: String, 
        required: true,
        trim: true,
    }, 
    role:{
        type: String, 
        enum: ['SuperAdmin', 'Admin', 'Standard'], 
        default: 'Standard'
    },
    email:{
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true, 
        trim: true, 
    }, 
    phone:{
        type: String, 
        trim: true, 
    },
    isActive:{
        type: Boolean, 
        default: true, 
    }, 
    lastlogin:{
        type: Date
    },
    ProfilePhoto:{
        type: String, 
    },
   password:{
    type: String, 
    required: true, 
   }, 
   Softwares:{
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Softwares",
    default: []
   },
   // Fields used by forgotPassword / resetPassword flow
   passwordResetToken: { type: String },
   passwordResetExpires: { type: Date },
},{timestamps: true})

const Users = mongoose.model("Users", userSchema)
module.exports = Users;