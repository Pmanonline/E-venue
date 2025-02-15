const jwt = require("jsonwebtoken");
const User = require("../models/userModel"); // Your user model

// utils/tokenUtils.js
const JWT_SECRET = process.env.JWT_SECRET || "Qwe123123"; // Add fallback secret

// Middleware to verify token
const auth = async (req, res, next) => {
  // Get token from header
  const token = req.header("Authorization")?.split(" ")[1]; // Extract token from "Bearer <token>"

  // Check if token is present
  if (!token) {
    return res
      .status(401)
      .json({ message: "No token provided, authorization denied" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user by decoded id
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found, authorization denied" });
    }

    // Attach user to request
    req.user = user;
    next(); // Proceed to the next middleware/route handler
  } catch (err) {
    console.error("Token verification failed:", err.message); // Log error for debugging
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = auth;
