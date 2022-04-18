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
  custDelete,
  userToken,
} = require('../controller/authController');
const {
  authMiddleware,
  authAdminCheck,
} = require('../middleware/authMiddleware');

router.post('/user-register', userRegister);
router.post('/user-login', userLogin);
router.post('/user-logout', authMiddleware, userLogout);
router.post('/user-list', authAdminCheck, userList);
router.post('/user-verify', authMiddleware, userVerify);
router.post('/user-change-password', authMiddleware, userChangePassword);
router.post('/user-delete', authAdminCheck, userDelete);
router.post('/cust-create', custCreate);
router.post('/cust-delete', authMiddleware, custDelete);
router.post('/token', authMiddleware, userToken);

module.exports = router;
