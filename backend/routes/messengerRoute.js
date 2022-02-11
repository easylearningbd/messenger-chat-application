const router = require('express').Router();

const {getFriends,messageUploadDB,messageGet} = require('../controller/messengerController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/get-friends',authMiddleware, getFriends);
router.post('/send-message',authMiddleware, messageUploadDB);
router.get('/get-message/:id',authMiddleware, messageGet);
 

module.exports = router;