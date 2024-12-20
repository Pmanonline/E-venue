const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const authmiddleware = async (req, res, next) => {
  try {
    // logs
    console.log("Incoming Request Details:");
    console.log("Method:", req.method);
    console.log("URL:", req.originalUrl);
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);

    // Get the full authorization header - MOVED THIS UP
    const authHeader = req.header("Authorization");

    // Debug logging
    console.log("Auth Header:", authHeader);

    // Check if auth header exists
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization header found",
      });
    }

    // Verify Bearer prefix and format
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format - Must start with 'Bearer '",
      });
    }

    // Extract token - MOVED THIS DOWN
    const token = authHeader.split(" ")[1];

    // Validate token exists after split
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided after Bearer prefix",
      });
    }

    // Debug logging
    console.log("Extracted Token:", token);

    // Verify token - MOVED THIS DOWN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Debug logging
    console.log("Decoded Token:", decoded);

    // Find user
    const user = await User.findById(decoded._id);
    console.log("user:", user);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      image: user.image,
    };

    // Debug logging
    console.log("Authenticated User:", {
      _id: req.user._id, // Changed from id to _id for consistency
      email: req.user.email,
      role: req.user.role,
    });

    next();
  } catch (error) {
    console.error("Auth Error Details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format or signature",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

module.exports = authmiddleware;
