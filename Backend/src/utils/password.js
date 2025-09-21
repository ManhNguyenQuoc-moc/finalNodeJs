const crypto = require("crypto");

const generateRandomPassword = (length = 8) => {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
};

module.exports = generateRandomPassword;
