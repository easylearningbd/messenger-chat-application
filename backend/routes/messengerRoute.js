const router = require('express').Router();

const {getFriends} = require('../controller/messengerController');

router.get('/get-friends',getFriends);
 

module.exports = router;