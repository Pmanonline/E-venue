const UserModel = require("../models/userModel.js");
const asyncHandler = require("express-async-handler");
const dotenv = require("dotenv");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cloudinary = require("cloudinary").v2;
const path = require("path");
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryService {
  static async uploadFile(file, folder = "Users") {
    try {
      if (!file?.tempFilePath) {
        throw new Error("Invalid file or missing temp file path");
      }

      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder,
        resource_type: "auto",
      });

      // Clean up temp file
      await fs.promises
        .unlink(file.tempFilePath)
        .catch((err) => console.error("Error deleting temp file:", err));

      return result.secure_url;
    } catch (error) {
      console.error("Upload to Cloudinary failed:", error);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  static async deleteFile(url) {
    if (!url) return;

    try {
      const publicId = this.getPublicIdFromUrl(url);
      if (!publicId) return;

      const result = await cloudinary.uploader.destroy(publicId, {
        type: "upload",
        resource_type: "image",
      });

      if (result.result !== "ok") {
        console.error(`Deletion failed for: ${publicId}`, result);
      }
    } catch (error) {
      console.error(`Failed to delete from Cloudinary: ${error.message}`);
    }
  }

  static getPublicIdFromUrl(url) {
    try {
      const urlParts = url.split("/");
      const versionIndex = urlParts.findIndex((part) => part.startsWith("v"));

      if (versionIndex === -1) {
        console.error(`Invalid Cloudinary URL format: ${url}`);
        return null;
      }

      return urlParts
        .slice(versionIndex + 1)
        .join("/")
        .replace(/\.[^/.]+$/, "");
    } catch (error) {
      console.error("Error parsing Cloudinary URL:", error);
      return null;
    }
  }
}

const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = { ...req.body };

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid User ID" });
  }

  try {
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Handle password update
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    } else {
      delete updateData.password;
    }

    // Handle image update
    if (req.files && req.files.image) {
      // Delete old image from Cloudinary if it exists
      if (user.image) {
        await CloudinaryService.deleteFile(user.image);
      }

      // Upload new image to Cloudinary
      try {
        updateData.image = await CloudinaryService.uploadFile(
          req.files.image,
          "Users"
        );
      } catch (error) {
        return res.status(400).json({ message: "Failed to upload image" });
      }
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
      new: true,
      select: "-password", // Exclude password from response
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found after update" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const deleteUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid User ID" });
  }

  try {
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user's image from Cloudinary if it exists
    if (user.image) {
      await CloudinaryService.deleteFile(user.image);
    }

    await UserModel.findByIdAndDelete(userId);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const getAllProfiles = asyncHandler(async (req, res) => {
  try {
    const users = await UserModel.find({});
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const getProfileById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid User ID" });
  }

  try {
    const profile = await UserModel.findById(userId);

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create a new object to avoid modifying the original document
    const profileResponse = profile.toObject();
    delete profileResponse.password;

    // If image exists, keep the full Cloudinary URL
    // No need to modify or extract basename

    res.status(200).json(profileResponse);
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const getUsers = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const startIndex = (page - 1) * limit;
    const sortDirection = req.query.sort === "asc" ? 1 : -1;

    const users = await UserModel.find()
      .sort({ createdAt: sortDirection })
      .skip(startIndex)
      .limit(limit);

    const usersWithoutPassword = users.map(
      ({ _doc: { password, ...rest } }) => rest
    );

    const totalUsers = await UserModel.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const lastMonthUsers = await UserModel.countDocuments({
      createdAt: { $gte: oneMonthAgo },
    });

    res.status(200).json({
      users: usersWithoutPassword,
      totalUsers,
      totalPages,
      lastMonthUsers,
    });
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skipIndex = (page - 1) * limit;

    const totalUsers = await UserModel.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await UserModel.find()
      .sort({ createdAt: -1 }) // Sort by most recent first
      .skip(skipIndex)
      .limit(limit);

    res.json({
      users, // Array of users
      currentPage: page,
      totalPages,
      totalUsers,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid User ID" });
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password, ...rest } = user._doc;
    res.status(200).json(rest);
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = {
  getAllProfiles,
  getProfileById,
  updateProfile,
  deleteUserById,
  getUsers,
  getAllUsers,
  getUserById,
};
