/* eslint-disable no-console */
const validator = require('validator');
const userAuthModel = require('../models/authModel');
const data = require('../data/messageStore');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const uTypes = data.types;
const uStatus = data.status;

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
          status: type === uTypes.admin ? uStatus.active : uStatus.created,
        });

        if (userCreate.uType === uTypes.admin) {
          const token = jwt.sign(
            {
              id: userCreate._id,
              userName: userCreate.userName,
              name: userCreate.name,
              type: userCreate.uType,
              verified: userCreate.verified,
              status: userCreate.status,
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

        if (matchPassword && checkUser.verified && checkUser.status === uStatus.active) {
          const token = jwt.sign(
            {
              id: checkUser._id,
              userName: checkUser.userName,
              name: checkUser.name,
              type: checkUser.uType,
              verified: checkUser.verified,
              status: checkUser.status,
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
              token,
            });
        } else {
          res.status(400).json({
            error: {
              code:
                checkUser.verified === false
                  ? data.authErrors.verifyFailed
                  : data.authErrors.invalidPassword,
              detail: checkUser.status,
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
  if (req.myId && (req.type === uTypes.admin || req.type === uTypes.agent)) {
    // update log data with logout time
    res.status(200).cookie('authToken', '').json({
      success: true,
    });
  } else {
    res.status(400).json({
      error: {
        code: data.authErrors.userNotFound,
      },
    });
  }
};

module.exports.userVerify = async (req, res) => {
  // if admin, will verify all IDs passed under verifyList (for agent verification)
  // customer will be verified once chat is accepted
  const { verifyList } = req.body;
  try {
    if (req.myId) {
      //user token exists.
      if (req.type === uTypes.admin) {
        // verify all IDs under verifyList
        verifyList.forEach(async (element) => {
          await userAuthModel.findOneAndUpdate(
            {
              userName: element.userName,
              email: element.email,
              type: uTypes.agent,
            },
            {
              verified: true,
              status: uStatus.active,
            },
            {
              new: true,
            }
          );
        });
      } else if (req.type === uTypes.agent) {
        await userAuthModel.findOneAndUpdate(
          {
            _id: verifyList[0],
          },
          {
            verified: true,
            status: uStatus.active,
          },
          {
            new: true,
          }
        );
      }
      res.status(200).json({
        success: true,
        message: data.authSuccess.userVerified,
        detail: verifyList,
      });
    }
  } catch (err) {
    res.status(400).json({
      error: {
        code: data.authErrors.verifyFailed,
        detail: err,
      },
    });
  }
};

module.exports.userList = async (req, res) => {
  // fetch list of users where type = agent
  try {
    if (req.myId && req.type === uTypes.admin) {
      const { verified, status } = req.body;
      // find agents who are 'created' (new + unverified), 'active' (current + verified) or 'deleted' (old + unverified)
      const listAgents = await userAuthModel.find({
        uType: uTypes.agent,
        verified: verified,
        status: status,
      });

      if (listAgents && listAgents.length > 0) {
        res.status(200).json({
          success: true,
          detail: {
            listAgents,
            count: listAgents.length,
          },
        });
      } else {
        res.status(400).json({
          error: {
            code: data.authErrors.userNotFound,
          },
        });
      }
    } else {
      res.status(400).json({
        error: {
          code: data.authErrors.invalidType,
        },
      });
    }
  } catch (err) {
    res.status(400).json({
      error: {
        code: data.common.serverError,
        detail: err,
      },
    });
  }
};

module.exports.userChangePassword = async (req, res) => {
  //check if the user and token match and allow password to be changed
  const { userName, password, newPassword, confirmPassword } = req.body;
  try {
    if (req.type !== uTypes.customer) {
      const checkUser = await userAuthModel
        .findOne({
          _id: req.myId,
          type: req.type,
        })
        .select('+password');

      if (checkUser) {
        const matchPassword = await bcrypt.compare(
          password,
          checkUser.password
        );

        if (!matchPassword) throw data.authErrors.invalidPassword;

        if (checkUser.type === uTypes.admin && userName !== checkUser.userName) {
          //trying to remove admin account without providing userName
          throw data.authErrors.adminMissing;
        }

        if (
          !newPassword ||
          !confirmPassword ||
          newPassword !== confirmPassword ||
          newPassword.length < 6
        ) {
          throw data.authErrors.incorrectPassword;
        }

        const updateUser = await userAuthModel.findOneAndUpdate(
          {
            _id: checkUser._id,
            email: checkUser.email,
            userName: checkUser.userName,
          },
          {
            password: await bcrypt.hash(newPassword, 10),
          },
          {
            new: true,
          }
        );

        if (updateUser) {
          res.status(200).json({
            success: true,
            message: data.authSuccess.passwordUpdated,
            detail: updateUser,
          });
        } else throw data.authErrors.updateFailed;
      } else {
        throw data.authErrors.userNotFound;
      }
    }
  } catch (err) {
    res.status(400).json({
      error: {
        code: data.common.serverError,
        detail: err,
      },
    });
  }
};

module.exports.userDelete = async (req, res) => {
  //unverify user passed as attribute if current user type is admin
  const { password, agentUName, agentEmail } = req.body;
  try {
    const checkAdmin = await userAuthModel
      .findOne({
        _id: req.myId,
        type: req.type,
      })
      .select('+password');

    if (checkAdmin) {
      const matchPassword = await bcrypt.compare(password, checkAdmin.password);

      if (matchPassword && req.type === uTypes.admin) {
        //admin confirmed. Unverify user if type == agent
        const delUser = await userAuthModel.findOneAndUpdate(
          {
            userName: agentUName,
            email: agentEmail,
            type: uTypes.agent,
          },
          {
            verified: false,
          },
          {
            new: true,
          }
        );

        if (delUser) {
          res.status(200).json({
            success: true,
            message: data.authSuccess.userDeleted,
          });
        } else {
          res.status(400).json({
            error: {
              code: data.authErrors.deleteFailed,
            },
          });
        }
      } else {
        res.status(400).json({
          error: {
            code: data.authErrors.adminMissing,
            detail: data.authErrors.invalidPassword,
          },
        });
      }
    } else {
      res.status(400).json({
        error: {
          code: data.authErrors.invalidType,
        },
      });
    }
  } catch (err) {
    res.status(400).json({
      error: {
        code: data.common.serverError,
      },
    });
  }
};

module.exports.custCreate = async (req, res) => {
  //create a temporary user
  const chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
  const { name, pincode } = req;
  const userName =
    name +
    pincode +
    chars[Math.floor(Math.random() * 26)] +
    Math.random().toString(36).substring(2, 8);
  const email =
    chars[Math.floor(Math.random() * 26)] +
    Math.random().toString(36).substring(2, 11) +
    '@customer.com';
  const password =
    chars[Math.floor(Math.random() * 26)] +
    Math.random().toString(36).substring(2, 11);
  const uType = 'consumer';
  const custCreate = await userAuthModel.create({
    userName,
    name,
    email,
    uType,
    password: await bcrypt.hash(password, 10),
    verified: false,
    status: uStatus.created,
  });

  const token = jwt.sign(
    {
      id: custCreate._id,
      userName: custCreate.userName,
      name: custCreate.name,
      type: custCreate.uType,
      verified: custCreate.verified,
      status: custCreate.status,
      registerTime: custCreate.createdAt,
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

  res.status(201).cookie('authToken', token, options).json({
    success: true,
    message: data.authSuccess.userAdded,
    token,
  });
};

module.exports.userToken = async (req, res) => {
  // keep checking if user is present in the system, else delete token.
  // To be run every 60 seconds to force session to terminate if chat has ended.
  try {
    const checkUser = await userAuthModel.findOne({
      _id: req.myId,
      type: req.type,
      status: req.type === uTypes.customer ? { $ne: uStatus.deleted } : uStatus.active,
    });
    if (!checkUser) {
      res.status(200).cookie('authToken', '').json({
        success: true,
        message: data.authSuccess.tokenDeleted,
      });
    } else {
      if (checkUser.uType === uTypes.customer && (checkUser.status === uStatus.active)) {
        // customer chat request has been accepted by agent. Customer is now active & verified
        const token = jwt.sign(
          {
            id: checkUser._id,
            userName: checkUser.userName,
            name: checkUser.name,
            type: checkUser.type,
            verified: checkUser.verified,
            status: checkUser.status,
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
      
        res.status(201).cookie('authToken', token, options).json({
          success: true,
          message: data.authSuccess.userAdded,
          token,
        });
      }
    }
  } catch (err) {
    res.status(404).json({
      error: {
        code: data.common.serverError,
        detail: err,
      },
    });
  }
};

module.exports.custDelete = async (req, res) => {
  //delete customerID generated after chat has ended
  const error = [];
  try {
    const checkUser = await userAuthModel.findOneAndUpdate(
      {
        _id: req.myId,
        type: req.type,
      },
      {
        verified: false,
        status: uStatus.deleted
      }
    );

    if (checkUser) {
      res.status(200).cookie('authToken', '').json({
        success: true,
        message: data.authSuccess.custDeleted,
        detail: data.authSuccess.tokenDeleted
      });
    } else {
      error.push(data.authErrors.userNotFound);
    }
  } catch (err) {
    error.push(err);
  }

  if (error.length > 0) {
    res.status(400).json({
      error: {
        code: data.common.serverError,
        errorMessage: error,
      },
    });
  }
};
