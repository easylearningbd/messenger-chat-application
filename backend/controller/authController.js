const validator = require('validator');
const userAuthModel = require('../models/authModel');
const data = require('../data/messageStore');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const uTypes = data.types;

let decodeTokenData = (token) => {
  try {
    let tokenData = jwt.verify(token, process.env.SECRET);
    return tokenData;
  } catch (err) {
    return false;
  }
  
}

module.exports.userRegister = async (req, res) => {
  // for registering new agents / admin if admin not present
  const { userName, name, email, type, password, confirmPassword } = req.body;
  const error = [];

  if (!userName || userName.length < 6 || userName.indexOf(' ') !== -1) {
    error.push(data.authErrors.invalidUName);
  }

  if (!name || /\d/.test(name)) {
    error.push(data.authErrors.invalidName);
  }

  if (!email || !validator.isEmail(email)) {
    error.push(data.authErrors.invalidEmail);
  }

  if (
    !password ||
    !confirmPassword ||
    (password !== confirmPassword && password.length < 6)
  ) {
    error.push(data.authErrors.invalidPassword);
  }

  if (!type || type === uTypes.customer) {
    error.push(data.authErrors.invalidType);
  }

  if (error.length > 0) {
    res.status(400).json({
      error: {
        code: error,
      },
    });
  } else {
    try {
      const checkAdmin = await userAuthModel.findOne({
        type: uTypes.admin,
      });
      if (type === uTypes.admin && checkAdmin) {
        throw data.authErrors.userExists;
      }

      if (type === uTypes.agent && !checkAdmin) {
        throw data.authErrors.adminMissing;
      }

      const checkUser = await userAuthModel.findOne({
        email: email,
      });
      if (checkUser) {
        res.status(404).json({
          error: {
            code: data.authErrors.userExists,
          },
        });
      } else {
        const userCreate = await userAuthModel.create({
          userName,
          email,
          name,
          uType: type,
          password: await bcrypt.hash(password, 10),
          verified: type === uTypes.admin ? true : false,
        });

        if (userCreate.uType === uTypes.admin) {
          const token = jwt.sign(
            {
              id: userCreate._id,
              email: userCreate.email,
              name: userCreate.name,
              type: userCreate.uType,
              registerTime: userCreate.createdAt,
            },
            process.env.SECRET,
            {
              expiresIn: process.env.TOKEN_EXP,
            }
          );

          const options = {
            expires: new Date(
              Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
            ),
          };

          res
            .status(201)
            .cookie('authToken', token, options)
            .json({
              success: true,
              message: data.authSuccess.userAdded,
              detail: {
                userId: userCreate._id,
                registerTime: userCreate.createdAt,
              },
              token,
            });
        } else {
          res.status(200).json({
            success: true,
            message: data.authSuccess.userAdded,
            detail: userCreate.userName,
            description: 'user created. please login',
          });
        }
      }
    } catch (err) {
      res.status(500).json({
        error: {
          code: data.common.serverError,
          detail: err,
        },
      });
    }
  }
};

module.exports.userLogin = async (req, res) => {
  const error = [];
  const { email, userName, type, password } = req.body;

  if (!email || !validator.isEmail(email)) {
    error.push(data.authErrors.invalidEmail);
  }

  if (!type || type === uTypes.customer) {
    error.push(data.authErrors.invalidType);
  } else if (type === uTypes.admin) {
    if (!userName) {
      error.push(data.authErrors.invalidUName);
    }
  }

  if (!password) {
    error.push(data.authErrors.invalidPassword);
  }

  if (error.length > 0) {
    res.status(400).json({
      error: {
        code: data.common.serverError,
        errorMessage: error,
      },
    });
  } else {
    try {
      const findFilter =
        type === uTypes.admin
          ? {
              email: email,
              userName: userName,
            }
          : {
              email: email,
            };
      const checkUser = await userAuthModel
        .findOne(findFilter)
        .select('+password');

      if (checkUser) {
        const matchPassword = await bcrypt.compare(
          password,
          checkUser.password
        );

        if (matchPassword && checkUser.verified) {
          const token = jwt.sign(
            {
              id: checkUser._id,
              email: checkUser.email,
              type: checkUser.uType,
              registerTime: checkUser.createdAt,
            },
            process.env.SECRET,
            {
              expiresIn: process.env.TOKEN_EXP,
            }
          );
          const options = {
            expires: new Date(
              Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
            ),
          };

          res
            .status(200)
            .cookie('authToken', token, options)
            .json({
              success: true,
              message: data.authSuccess.userLogin,
              detail: {
                userId: checkUser._id,
                userName: checkUser.userName,
                email: checkUser.email,
              },
              token,
            });
        } else {
          res.status(400).json({
            error: {
              code: checkUser.verified
                ? data.authErrors.verifyFailed
                : data.authErrors.invalidPassword,
            },
          });
        }
      } else {
        res.status(400).json({
          error: {
            code: data.authErrors.userNotFound,
          },
        });
      }
    } catch (err) {
      res.status(404).json({
        error: {
          code: data.common.serverError,
          detail: err,
        },
      });
    }
  }
};

module.exports.userLogout = (req, res) => {
  const checkUser = decodeTokenData(req.cookies.authToken);
  if (checkUser){
    // update log data with logout time
    res.status(200).cookie('authToken', '').json({
      success: true,
    });
  } else {
    res.status(400).json({
      error: {
        code: data.authErrors.userNotFound
      }
    });
  }
};

module.exports.userVerify = async (req, res) => {
  // if admin, will verify all IDs passed under verifyList (for agent verification)
  // customer will be verified once chat is accepted
  const { verifyList } = req.body;
  let verifiedList = [];
  try {
    const checkUser = decodeTokenData(req.cookies.authToken);

    if (checkUser) { //user token exists. 
      if (checkUser.type === uTypes.admin) { // verify all IDs under verifyList
        verifyList.forEach(async (agentId) => {
          const verifyStatus = await userAuthModel.findOneAndUpdate({
            _id: agentId,
          }, {
            verified: true,
          }, {
            new: true
          });
          verifiedList.push(verifyStatus);
        });
      } else if (checkUser.type === uTypes.agent) { 
        const verifyCust = await userAuthModel.findOneAndUpdate({
          _id: verifyList[0]
        }, {
          verified: true,
        }, {
          new: true
        });
        verifiedList.push(verifyCust);
      }
      res.status(200).json({
        success: true,
        message: data.authSuccess.userVerified,
        detail: verifiedList
      });
    }
  } catch (err) {
    res.status(400).json({
      error: {
        code: data.authErrors.verifyFailed,
      },
    })
  }
};