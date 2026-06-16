const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const users = require("../Models/user.schema")
const bcryptjs = require("bcryptjs")

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const connecDB = async ()=>{
    try{
   let dburl = process.env.MONGO_URI;
    await mongoose.connect(dburl);
    console.log("Database Connected For Creating Admin")
    }catch(err){
        console.log(err.message)
    }
}

const CreateAdmin = async()=>{
    try{
    let adminEmail = process.env.ADMIN_EMAIL;
    let adminPhone = process.env.ADMIN_PHONE;
    let adminName = process.env.ADMIN_NAME;
    let adminPassword = process.env.ADMIN_PASSWORD;

    //check admin already present in db 
    let present = await users.findOne({email: adminEmail});
    if(present){
        return console.log("Admin Is Already Present")
    }else{

        //hased admin password
        let adminhash = await bcryptjs.genSalt(10);
        let hasedPassword =  await bcryptjs.hash(adminPassword, adminhash)


        let createNewAdmin = new users({
            name: adminName, 
            email: adminEmail, 
            password: hasedPassword, 
            phone: adminPhone, 
            role: "Admin"
        })
        await createNewAdmin.save();

        console.log(`New User Created
            Name: ${adminName}
            Email: ${adminEmail}
            `)
    }
    }catch(err){
        console.log(err.message)
    }
}

const main = async () => {
    await connecDB();
    await CreateAdmin();
    await mongoose.connection.close()   
    console.log("Database Connection Closed")
}
main();