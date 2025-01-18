const UserModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const validator = require("validator");
const JWT_SECRET = process.env.JWT_SECRET || "Qwe123123";
const crypto = require("crypto");
const { generateToken } = require("../middlewares/tokenUtils");

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const generateOTP = () => {
  return otpGenerator.generate(6, {
    digits: true,
    upperCase: false,
    specialChars: false,
    alphabets: false,
  });
};
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Login Authentication OTP",
    html: `
      <h2>Login Authentication Code</h2>
      <p>Your one-time password (OTP) for login is:</p>
      <h3>${otp}</h3>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

const registerUser = async (req, res) => {
  const { email, password, username } = req.body;

  try {
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!password || !username) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const passwordRegex = /^.{6,}$/;
    if (!passwordRegex.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 digits long" });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Existing User with this Email" });
    }

    const existingUserName = await UserModel.findOne({ username });
    if (existingUserName) {
      return res
        .status(400)
        .json({ message: "Existing User with this Username" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      email,
      password: hashedPassword,
      username,
      role: "user",
    });

    await newUser.save();

    const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Error during registration:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

const registerAdmin = async (req, res) => {
  const { email, password, username } = req.body;

  try {
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!password || !username) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const passwordRegex = /^.{6,}$/;
    if (!passwordRegex.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 digits long" });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new UserModel({
      email,
      password: hashedPassword,
      username,
      role: "admin",
    });

    await newAdmin.save();

    const token = jwt.sign({ _id: newAdmin._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: {
        _id: newAdmin._id,
        email: newAdmin.email,
        username: newAdmin.username,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error("Error during admin registration:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

// const login = async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await UserModel.findOne({ email });
//     if (!user || !(await bcrypt.compare(password, user.password))) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     const userData = {
//       _id: user._id,
//       username: user.username,
//       email: user.email,
//       role: user.role,
//     };

//     if (user.role === "admin") {
//       try {
//         const otp = generateOTP();
//         user.otp = otp;
//         user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
//         await user.save();

//         await sendOTPEmail(email, otp);

//         return res.status(200).json({
//           message: "OTP sent to your email",
//           requireOTP: true,
//           user: userData,
//         });
//       } catch (error) {
//         console.error("OTP generation/sending error:", error);
//         return res.status(500).json({ message: "Failed to send OTP" });
//       }
//     }

//     const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
//       expiresIn: "30d",
//     });

//     return res.status(200).json({
//       token,
//       user: userData,
//     });
//   } catch (error) {
//     console.error("Login Error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await UserModel.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    if (user.role === "admin") {
      try {
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        await sendOTPEmail(email, otp);

        return res.status(200).json({
          message: "OTP sent to your email",
          requireOTP: true,
          user: userData,
        });
      } catch (error) {
        console.error("OTP generation/sending error:", error);
        return res.status(500).json({ message: "Failed to send OTP" });
      }
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// const verifyAdminOTP = async (req, res) => {
//   const { userId, email, otp } = req.body;

//   if (!otp) {
//     return res.status(400).json({ message: "OTP is required" });
//   }

//   try {
//     let query = {
//       role: "admin",
//       otp,
//       otpExpiresAt: { $gt: Date.now() },
//     };

//     if (userId) {
//       query._id = userId;
//     } else if (email) {
//       query.email = email;
//     } else {
//       return res
//         .status(400)
//         .json({ message: "Either userId or email is required" });
//     }

//     const user = await UserModel.findOne(query);

//     if (!user) {
//       return res.status(401).json({
//         message: "Invalid or expired OTP",
//       });
//     }

//     if (user.otp !== otp) {
//       return res.status(401).json({
//         message: "Invalid OTP",
//       });
//     }

//     // Generate new token
//     const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
//       expiresIn: "30d",
//     });

//     // Clear OTP after successful verification
//     user.otp = undefined;
//     user.otpExpiresAt = undefined;
//     await user.save();

//     // Return consistent response structure
//     return res.status(200).json({
//       success: true,
//       token,
//       user: {
//         _id: user._id,
//         email: user.email,
//         username: user.username,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.error("Error during OTP verification:", error);
//     return res.status(500).json({
//       message: "Internal server error",
//       details: error.message,
//     });
//   }
// };

// Update verifyAdminOTP function
const verifyAdminOTP = async (req, res) => {
  const { userId, email, otp } = req.body;

  if (!otp) {
    return res.status(400).json({ message: "OTP is required" });
  }

  try {
    let query = {
      role: "admin",
      otp,
      otpExpiresAt: { $gt: Date.now() },
    };

    if (userId) {
      query._id = userId;
    } else if (email) {
      query.email = email;
    } else {
      return res
        .status(400)
        .json({ message: "Either userId or email is required" });
    }

    const user = await UserModel.findOne(query);

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired OTP",
      });
    }

    if (user.otp !== otp) {
      return res.status(401).json({
        message: "Invalid OTP",
      });
    }

    const token = generateToken(user._id);

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error during OTP verification:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: error.message,
    });
  }
};

const logout = (req, res) => {
  res.status(200).json({ message: "Successfully logged out" });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    console.log("Reset token:", resetToken);
    console.log("Token expiration time:", user.resetPasswordExpires);

    const frontendURL =
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173";

    const resetUrl = `${frontendURL}/reset-password/${resetToken}`;
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        ${resetUrl}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Reset password email sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Error in forgot password process" });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    const passwordRegex = /^.{6,}$/;
    if (!passwordRegex.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Your password has been changed",
      text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`,
    };
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password has been reset" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Error in reset password process" });
  }
};

const handleGoogleLogin = async (req, res) => {
  const { credential } = req.body;

  try {
    const decoded = jwt.decode(credential);

    if (!decoded) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    let user = await UserModel.findOne({ email: decoded.email });

    if (user && user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Admin accounts cannot login through Google authentication. Please use the standard login route.",
      });
    }

    if (!user) {
      // Create new user if doesn't exist
      user = new UserModel({
        email: decoded.email,
        username: decoded.name,
        googleId: decoded.sub,
        picture: decoded.picture,
        role: "user",
      });
      await user.save();
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing Google login",
    });
  }
};

module.exports = {
  registerUser,
  registerAdmin,
  login,
  forgotPassword,
  resetPassword,
  verifyAdminOTP,
  handleGoogleLogin,
  logout,
};
