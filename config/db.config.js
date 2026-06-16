const mongoose = require("mongoose")
const databaseConnection = async(req,res)=>{
   try{
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Database Is Connected:  " + mongoose.connection.name)
   }catch(err){
    console.log("These Was Err While Connecting To The Database:  " + err.message);
   }
}

module.exports = databaseConnection