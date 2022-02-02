const User = require('../models/authModel');

module.exports.getFriends = async (req, res) => {
     const myId = req.myId;
     // console.log(myId);
     try{
          const friendGet = await User.find({});
          const filter = friendGet.filter(d=>d.id !== myId );
          res.status(200).json({success:true, friends : filter})

     }catch (error) {
          res.status(500).json({
               error: {
                    errorMessage :'Internal Sever Error'
               }
          })
     } 
}

module.exports.messageUploadDB = async (req, res) =>{

     const senderId = req.myId;
     
     console.log(senderId)
     console.log(req.body);
}