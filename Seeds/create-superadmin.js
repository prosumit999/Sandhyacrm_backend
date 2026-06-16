const path = require("path")
const dotenv = require("dotenv")
const users = require("../Models/user.schema")
const bcryptjs = require("bcryptjs");
const mongoose = require("mongoose")

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connecDB = async ()=>{
    try{
   let dburl = process.env.MONGO_URI;
    await mongoose.connect(dburl);
    console.log("Database Connected For Creating SuperAdmin")
    }catch(err){
        console.log(err.message)
    }
}

const CreateSuperAdmin = async()=>{
    try{
    let adminEmail = process.env.SADMIN_EMAIL;
    let adminName = process.env.SADMIN_NAME;
    let adminPassword = process.env.SADMIN_PASSWORD;
    let adminPhone = process.env.SADMIN_PHONE;

    let findsuperadmin = await users.findOne({email: adminEmail})
    if(findsuperadmin){
        console.log("Superadmin Already Exists")
    }else{
        let genSalt = await bcryptjs.genSalt(10);
        let hasedPassword = await bcryptjs.hash(adminPassword, genSalt);

        let newSuperAdmin = new users({
           name: adminName, 
            email: adminEmail, 
            password: hasedPassword, 
            phone: adminPhone, 
            role: "SuperAdmin"
        })

      await newSuperAdmin.save();


       console.log(`New User Created
            Name: ${adminName}
            Email: ${adminEmail}
            `)

    }


    }catch(err){
        console.log(err)
    }
}   
const main = async () => {
    await connecDB();
    await CreateSuperAdmin();
    await mongoose.connection.close();
    console.log("Database Connection Closed")
}
main();