const jwt = require('jsonwebtoken');

module.exports.authMiddleware = async (req, res, next) => {
  const { authToken } = req.cookies;
  if (authToken) {
    const deCodeToken = await jwt.verify(authToken, process.env.SECRET);
    req.myId = deCodeToken.id;
    req.type = deCodeToken.type;
    req.verified = deCodeToken.verified;
    req.status = deCodeToken.status;
    next();
  } else {
    res.status(400).json({
      error: {
        errorMessage: ['No user login found'],
      },
    });
  }
};

module.exports.authAdminCheck = async (req, res, next) => {
  const { authToken } = req.cookies;
  if (authToken) {
    const deCodeToken = await jwt.verify(authToken, process.env.SECRET);
    req.myId = deCodeToken.id;
    req.type = deCodeToken.type;
    if (!deCodeToken.verifiedAdmin) {
      res.status(400).json({
        error: {
          errorMessage: ['No Admin'],
        },
      });
    } else next();
  } else {
    res.status(400).json({
      error: {
        errorMessage: ['No user login found'],
      },
    });
  }
};
