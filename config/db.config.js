const mongoose = require("mongoose")
const databaseConnection = async () => {
   try {
     const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sandhya_crm"
     await mongoose.connect(uri, {
       useNewUrlParser: true,
       useUnifiedTopology: true,
     })
     console.log("Database is connected:", mongoose.connection.name)
   } catch (err) {
     console.error("Error connecting to the database:", err.message)
     process.exit(1)
   }
}

module.exports = databaseConnection