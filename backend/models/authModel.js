const { model, Schema } = require('mongoose');

const registerSchema = new Schema(
  {
    userName: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    uType: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    verified: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = model('user', registerSchema);
