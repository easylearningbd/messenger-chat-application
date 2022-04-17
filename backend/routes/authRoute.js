const router = require('express').Router();

const {
  userRegister,
  userLogin,
  userLogout,
  userList,
  userVerify,
  userChangePassword,
  userDelete,
  custCreate,
  userToken,
} = require('../controller/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/user-register', userRegister);
router.post('/user-login', userLogin);
router.post('/user-logout', authMiddleware, userLogout);
router.post('/user-list', authMiddleware, userList);
router.post('/user-verify', authMiddleware, userVerify);
router.post('/user-change-password', authMiddleware, userChangePassword);
router.post('/user-delete', authMiddleware, userDelete);
router.post('/cust-create', custCreate);
router.post('/token', authMiddleware, userToken);

module.exports = router;
