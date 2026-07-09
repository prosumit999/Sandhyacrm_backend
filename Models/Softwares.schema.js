const mongoose = require("mongoose")

const SoftwareSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: ["Desktop", "Mobile", "Web", "SAAS", "API", "PAAS"],
    },

    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Quarterly", "HalfYearly", "Yearly", "OneTime"],
      default: "Yearly",
    },

   
    liveUrl: {
      type: String,       
      trim: true,
    },
    playStoreUrl: {
      type: String,       
      trim: true,
    },
    appStoreUrl: {
      type: String,       
      trim: true,
    },
    downloadUrl: {
      type: String,    
      trim: true,
    },
    githubRepoUrl: {
      type: String,
      trim: true,
    },

   
    hostingProvider: {
      type: String,       
    },
    hostingExpiryDate: {
      type: Date,
    },
    domainProvider: {
      type: String,      
      trim: true,
    },
    domainExpiryDate: {
      type: Date,
    },
    sslExpiryDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["Live", "Broken", "Maintenance", "Development", "Paused"],
      default: "Live",
    },

    version: {
      type: String,        // e.g. "v2.1.0"
      trim: true,
    },
    builtFor: {
      type: String,
      enum: ["Client", "SAAS", "Internal"],
      default: "Client",
    },
    techStack: {
      type: [String],      // e.g. ["React", "Node.js", "MongoDB"]
      default: [],
    },

    developer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
  },
  { timestamps: true }
)

const Softwares = mongoose.model("Softwares", SoftwareSchema)
module.exports = Softwares
