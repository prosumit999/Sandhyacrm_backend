const jwt = require("jsonwebtoken")

const checkroles = (...roles)=>{
    return async(req,res, next)=>{

        try{
              const getlogintoken = req.cookies.logintoken;

              //check login token 
              if(!getlogintoken){
                return res.status(401).json({
                    success: false, 
                    message: "Authentication Failed, Login First"
                })
              }

              const user = jwt.verify(getlogintoken, process.env.JWT_SEC);

              if(!roles.includes(user.role)){
                return res.status(403).json({
                    success: false, 
                    message: "Access Denied"
                })
              }

              req.user = user

        next()
        }catch(err){
          return res.status(401).json({
            success: false,
            message: "Invalid Or Expired Token "
          })
        }
    }
}

module.exports = checkroles;