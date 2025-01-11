const Businesz = require("../models/businessModel");
const VerificationRequest = require("../models/verificationRequestModel");
const PaymentNotification = require("../models/paymentNotificationModdel");
const asyncHandler = require("express-async-handler");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (file, folder = "businesses") => {
  try {
    console.log("Uploading file to Cloudinary:", file.name);
    if (!file.tempFilePath) {
      throw new Error("No temp file path found");
    }

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: folder,
      resource_type: "auto",
    });

    // Clean up temp file after successful upload
    fs.unlink(file.tempFilePath, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    return result.secure_url;
  } catch (error) {
    console.error("Upload to Cloudinary failed:", error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (url) => {
  try {
    if (!url) return;
    console.log("Attempting to delete URL:", url);

    // Parse the Cloudinary URL
    const urlParts = url.split("/");

    // Find the version and public ID
    const versionIndex = urlParts.findIndex((part) => part.startsWith("v"));
    if (versionIndex === -1) {
      console.error(`Invalid Cloudinary URL format: ${url}`);
      return;
    }

    // Construct the public ID
    const publicId = urlParts
      .slice(versionIndex + 1)
      .join("/")
      .replace(/\.[^/.]+$/, "");

    const result = await cloudinary.uploader.destroy(publicId, {
      type: "upload",
      resource_type: "image",
    });

    if (result.result === "ok") {
      console.log(`Successfully deleted image from Cloudinary: ${publicId}`);
    } else {
      console.error(`Deletion failed for: ${publicId}`, result);
    }
  } catch (error) {
    console.error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

// const createBusiness = async (req, res) => {
//   try {
//     console.log("Incoming request details:");
//     console.log("Headers:", req.headers);
//     console.log("Body:", req.body);
//     console.log("Files:", req.files);

//     // Validate request
//     if (!req.body) {
//       return res.status(400).json({
//         message: "No request body received",
//         details: "Request body is empty or malformed",
//       });
//     }

//     let businessData;
//     try {
//       businessData = JSON.parse(req.body.businessData);
//     } catch (error) {
//       console.error("Error parsing businessData:", error, {
//         receivedData: req.body.businessData,
//         error: error.message,
//       });
//       return res.status(400).json({ message: "Invalid businessData format" });
//     }

//     // Initialize coverImageUrl as null
//     let coverImageUrl = null;

//     // Upload cover image if provided
//     if (req.files && req.files.coverImage) {
//       coverImageUrl = await uploadToCloudinary(req.files.coverImage);
//       console.log("Cover image uploaded:", coverImageUrl);
//     } else {
//       console.log("No cover image provided, proceeding without it.");
//     }

//     // Upload additional images if any
//     let additionalImageUrls = [];
//     if (req.files && req.files.additionalImages) {
//       const additionalImages = Array.isArray(req.files.additionalImages)
//         ? req.files.additionalImages
//         : [req.files.additionalImages];

//       for (const image of additionalImages) {
//         try {
//           const url = await uploadToCloudinary(image);
//           additionalImageUrls.push(url);
//         } catch (error) {
//           console.error("Error uploading additional image:", error);
//           // Continue with other images even if one fails
//         }
//       }
//       console.log("Additional images uploaded:", additionalImageUrls);
//     }

//     // Extract user ID from the request (assuming it's stored in req.user after authentication)
//     const userId = req.user._id; // Adjust this based on your authentication middleware
//     console.log("console.log(userId)", userId);
//     const business = new Businesz({
//       ...businessData,
//       coverImage: coverImageUrl,
//       additionalImages: additionalImageUrls,
//       createdBy: userId, // Include the createdBy field
//     });

//     await business.save();
//     res.status(201).json(business);
//   } catch (error) {
//     console.error("Error in createBusiness:", error);
//     res.status(500).json({
//       message: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

const createBusiness = async (req, res) => {
  try {
    console.log("Incoming request details:");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    // Validate request
    if (!req.body?.businessData) {
      return res.status(400).json({
        message: "No business data received",
        details: "businessData is required in the request body",
      });
    }

    let businessData;
    try {
      businessData = JSON.parse(req.body.businessData);
    } catch (error) {
      console.error("Error parsing businessData:", error, {
        receivedData: req.body.businessData,
      });
      return res.status(400).json({ message: "Invalid businessData format" });
    }

    // Extract user ID from the authenticated request
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Handle image uploads
    let coverImageUrl = null;
    if (req.files?.coverImage) {
      try {
        coverImageUrl = await uploadToCloudinary(req.files.coverImage);
        console.log("Cover image uploaded:", coverImageUrl);
      } catch (error) {
        console.error("Error uploading cover image:", error);
        return res.status(500).json({ message: "Cover image upload failed" });
      }
    } else {
      console.log("No cover image provided, proceeding without it.");
    }

    let additionalImageUrls = [];
    if (req.files?.additionalImages) {
      const additionalImages = Array.isArray(req.files.additionalImages)
        ? req.files.additionalImages
        : [req.files.additionalImages];

      for (const image of additionalImages) {
        try {
          const url = await uploadToCloudinary(image);
          additionalImageUrls.push(url);
        } catch (error) {
          console.error("Error uploading additional image:", error);
        }
      }
      console.log("Additional images uploaded:", additionalImageUrls);
    }

    // Create business instance
    const business = new Businesz({
      ...businessData,

      coverImage: coverImageUrl,
      additionalImages: additionalImageUrls,
      createdBy: userId, // Include the user ID
      ownerId: userId,
    });

    await business.save();
    console.log("Business created successfully:", business);
    res.status(201).json(business);
  } catch (error) {
    console.error("Error in createBusiness:", error);
    res.status(500).json({
      message: "An error occurred while creating the business",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const getAllBusinesses = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skipIndex = (page - 1) * limit;
    const search = req.query.search || "";

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    const totalBusinesses = await Businesz.countDocuments(query);
    const totalPages = Math.ceil(totalBusinesses / limit);

    const businesses = await Businesz.find(query)
      .select(
        "name type email phoneNumber verificationStatus blacklistStatus address yearsOfExperience bio coverImage additionalImages openingHours verified blacklisted createdAt ownerId"
      ) // Include additional fields here
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(limit);

    res.json({
      businesses,
      currentPage: page,
      totalPages,
      totalBusinesses,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await Businesz.findById(id).populate({
      path: "createdBy",
      select: "-password -refreshToken", // Exclude sensitive fields
    });

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    res.status(200).json(business);
  } catch (error) {
    console.error("Error fetching business:", error);
    res.status(500).json({
      message: "Error fetching business details",
      error: error.message,
    });
  }
};
const updateBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const businessData = JSON.parse(req.body.businessData);
    const business = await Businesz.findById(id);

    if (!business) {
      return res.status(404).json({ message: "Businesz not found" });
    }

    // Handle cover image update
    if (req.files && req.files.coverImage) {
      await deleteFromCloudinary(business.coverImage);
      businessData.coverImage = await uploadToCloudinary(req.files.coverImage);
    }

    // Handle additional images update
    if (req.files && req.files.additionalImages) {
      // Delete existing images
      for (const imageUrl of business.additionalImages) {
        await deleteFromCloudinary(imageUrl);
      }

      // Upload new images
      const additionalImages = Array.isArray(req.files.additionalImages)
        ? req.files.additionalImages
        : [req.files.additionalImages];

      const uploadPromises = additionalImages.map((file) =>
        uploadToCloudinary(file)
      );
      businessData.additionalImages = await Promise.all(uploadPromises);
    }

    // Update verification and blacklist status if provided
    if (businessData.hasOwnProperty("verified")) {
      business.verified = businessData.verified;
    }
    if (businessData.hasOwnProperty("blacklisted")) {
      business.blacklisted = businessData.blacklisted;
    }

    const updatedBusiness = await Businesz.findByIdAndUpdate(id, businessData, {
      new: true,
    });

    res.json(updatedBusiness);
  } catch (error) {
    console.error("Error in updateBusiness:", error);
    res.status(500).json({ message: error.message });
  }
};

const deleteBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await Businesz.findById(id);

    if (!business) {
      return res.status(404).json({ message: "Businesz not found" });
    }

    // Delete cover image from Cloudinary
    if (business.coverImage) {
      await deleteFromCloudinary(business.coverImage);
    }

    // Delete additional images from Cloudinary
    if (business.additionalImages && business.additionalImages.length > 0) {
      for (const imageUrl of business.additionalImages) {
        await deleteFromCloudinary(imageUrl);
      }
    }

    // Delete the business from database
    await Businesz.findByIdAndDelete(id);
    res.status(200).json({ message: "Businesz deleted successfully" });
  } catch (error) {
    console.error("Error in deleteBusiness:", error);
    res.status(500).json({
      message: "Failed to delete business",
      error: error.message,
    });
  }
};

const removeBusinessImage = async (req, res) => {
  try {
    const { businessId, imageUrl, imageType } = req.body;

    if (!businessId || !imageUrl || !imageType) {
      return res.status(400).json({
        message: "Businesz ID, image URL, and image type are required",
      });
    }

    const business = await Businesz.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Businesz not found" });
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(imageUrl);

    // Update the business document based on image type
    if (imageType === "coverImage") {
      business.coverImage = null;
    } else if (imageType === "additionalImages") {
      business.additionalImages = business.additionalImages.filter(
        (img) => img !== imageUrl
      );
    }

    await business.save();

    res.status(200).json({
      message: "Image removed successfully",
      business,
    });
  } catch (error) {
    console.error("Error removing image:", error);
    res.status(500).json({
      message: "Failed to remove image",
      error: error.message,
    });
  }
};

const verifyBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { reason, verificationId } = req.body;

    const business = await Businesz.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    try {
      // Update business verification status
      business.verified = !business.verified;
      business.verificationDetails = {
        verifiedAt: new Date(),
        reason:
          reason ||
          (business.verified ? "Business verified" : "Verification removed"),
      };
      await business.save();

      // If verificationId is provided, update the verification request status
      if (verificationId) {
        await VerificationRequest.findByIdAndUpdate(
          verificationId,
          {
            status: business.verified ? "approved" : "rejected",
          },
          { new: true }
        );
      } else {
        // If no verificationId provided, try to find and update the latest verification request
        const verificationRequest = await VerificationRequest.findOne(
          { businessId: businessId },
          {},
          { sort: { createdAt: -1 } }
        );

        if (verificationRequest) {
          verificationRequest.status = business.verified
            ? "approved"
            : "rejected";
          await verificationRequest.save();
        }
      }

      // Create notification for business owner
      const notification = new PaymentNotification({
        userId: business.createdBy,
        type: "VERIFICATION_STATUS",
        title: business.verified
          ? "Business Verification Approved"
          : "Business Verification Rejected",
        message: business.verified
          ? `Your business ${business.name} has been successfully verified.`
          : `Your business ${business.name} verification has been rejected.`,
        recipients: [business.createdBy.toString()],
        relatedData: {
          businessId: business._id,
          status: business.verified ? "approved" : "rejected",
          reason: reason,
        },
      });

      await notification.save();

      return res.status(200).json({
        success: true,
        message: business.verified
          ? "Business verified successfully"
          : "Business verification removed",
        business: business,
      });
    } catch (error) {
      // If any operation fails, attempt to revert business verification status
      if (business) {
        business.verified = !business.verified;
        await business.save().catch(console.error);
      }
      throw error;
    }
  } catch (error) {
    console.error("Verify business error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update business verification status",
      error: error.message,
    });
  }
};

const blacklistBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { reason, duration } = req.body;

    // Validate input
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for blacklisting",
      });
    }

    // Find the business
    const business = await Businesz.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    try {
      // Convert duration from days to milliseconds if provided
      const durationMs = duration ? duration * 24 * 60 * 60 * 1000 : null;

      // Update blacklist status
      business.blacklisted = !business.blacklisted;
      business.blacklistDetails = {
        blacklistedAt: new Date(),
        reason: reason,
        duration: durationMs ? new Date(Date.now() + durationMs) : null,
      };
      await business.save();

      // Create notification for blacklist status
      const notification = new PaymentNotification({
        userId: business.createdBy,
        type: "BLACKLIST_STATUS",
        title: business.blacklisted
          ? "Business Blacklisted"
          : "Business Removed from Blacklist",
        message: business.blacklisted
          ? `Your business ${business.name} has been blacklisted. Reason: ${reason}`
          : `Your business ${business.name} has been removed from the blacklist.`,
        recipients: [business.createdBy],
        relatedData: {
          businessId: business._id,
          status: business.blacklisted ? "blacklisted" : "removed",
          reason: reason,
          duration: durationMs ? new Date(Date.now() + durationMs) : null,
        },
      });

      await notification.save();

      return res.status(200).json({
        success: true,
        message: business.blacklisted
          ? "Business blacklisted successfully"
          : "Business removed from blacklist",
        business: business,
      });
    } catch (error) {
      // If any operation fails, attempt to revert blacklist status
      if (business) {
        business.blacklisted = !business.blacklisted;
        await business.save().catch(console.error);
      }
      throw error;
    }
  } catch (error) {
    console.error("Blacklist business error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update business blacklist status",
      error: error.message,
    });
  }
};

module.exports = {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  removeBusinessImage,
  verifyBusiness,
  blacklistBusiness,
};
