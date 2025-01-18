// utils/tokenUtils.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (userId) => {
  const tokenLifetime = "30d";
  const token = jwt.sign({ _id: userId }, JWT_SECRET, {
    expiresIn: tokenLifetime,
  });

  // Decode token to get expiration time
  const decoded = jwt.decode(token);
  console.log(`Token generated for user ${userId}:`);
  console.log(`Issue time: ${new Date(decoded.iat * 1000).toISOString()}`);
  console.log(`Expiration time: ${new Date(decoded.exp * 1000).toISOString()}`);

  return token;
};

module.exports = { generateToken };
