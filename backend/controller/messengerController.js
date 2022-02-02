const User = require('../models/authModel');
const messageModel = require('../models/messageModel');

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

     const {
          senderName,
          reseverId,
          message
     } = req.body
     const senderId = req.myId;

     try{
          const insertMessage = await messageModel.create({
               senderId : senderId,
               senderName : senderName,
               reseverId : reseverId,
               message : {
                    text: message,
                    image : ''
               }
          })
          res.status(201).json({
               success : true,
               message: insertMessage
          })

     }catch (error){
          res.status(500).json({
               error: {
                    errorMessage : 'Internal Sever Error'
               }
          })
     }

     
}