const router = require('express').Router();

const {getFriends} = require('../controller/messengerController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/get-friends',authMiddleware, getFriends);
 

module.exports = router;