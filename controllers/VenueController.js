const Venue = require("../models/venueModel");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const VerificationRequest = require("../models/verificationRequestModel");
const PaymentNotification = require("../models/paymentNotificationModdel");
const mongoose = require("mongoose");
const axios = require("axios");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (file, folder = "venues") => {
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

// create coodinate
const getCoordinates = async (address) => {
  try {
    // Validate address components
    if (!address.street || !address.lga || !address.state) {
      console.error("Incomplete address:", address);
      return null;
    }

    const fullAddress = `${address.street}, ${address.lga}, ${address.state}`;

    // More robust logging
    console.log("Geocoding address:", fullAddress);

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: fullAddress,
          key: process.env.GOOGLE_MAPS_API_KEY, // Use environment variable
        },
        timeout: 5000, // Add timeout to prevent hanging
      }
    );

    console.log("Geocoding response status:", response.data.status);
    console.log("Geocoding results:", response.data.results);

    if (response.data.status === "OK" && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } else {
      console.warn("Geocoding failed:", {
        status: response.data.status,
        results: response.data.results,
      });
      return null;
    }
  } catch (error) {
    console.error("Geocoding error:", {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
};

async function createVenue(req, res) {
  try {
    console.log("Incoming request details:");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    // Validate request
    if (!req.body) {
      return res.status(400).json({
        message: "No request body received",
        details: "Request body is empty or malformed",
      });
    }

    let venueData;
    try {
      venueData = JSON.parse(req.body.venueData);
    } catch (error) {
      console.error("Error parsing venueData:", error, {
        receivedData: req.body.venueData,
        error: error.message,
      });
      return res.status(400).json({ message: "Invalid venueData format" });
    }

    // Geocode address
    const coordinates = await getCoordinates(venueData.address);
    if (coordinates) {
      venueData.address.latitude = coordinates.latitude;
      venueData.address.longitude = coordinates.longitude;
    } else {
      // Set default coordinates or log a warning
      console.warn("Geocoding failed for address:", venueData.address);
      venueData.address.latitude = null;
      venueData.address.longitude = null;
    }

    // Validate required fields
    const requiredFields = ["title", "businessEmail", "capacity", "type"];

    const missingFields = requiredFields.filter((field) => {
      const value = field
        .split(".")
        .reduce((obj, key) => obj?.[key], venueData);
      return !value;
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Missing required fields",
        fields: missingFields,
      });
    }

    // Validate business phone numbers
    if (venueData.businessPhoneNumbers?.length > 2) {
      return res.status(400).json({
        message: "Maximum of 2 phone numbers allowed",
      });
    }

    // Extract user ID from the authenticated request
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Handle image uploads
    let coverImageUrl = null;
    let additionalImageUrls = [];

    if (req.files?.coverImage) {
      try {
        coverImageUrl = await uploadToCloudinary(req.files.coverImage);
        console.log("Cover image uploaded:", coverImageUrl);
      } catch (error) {
        console.error("Error uploading cover image:", error);
        return res.status(500).json({ message: "Cover image upload failed" });
      }
    }

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

    // Create venue instance
    const venue = new Venue({
      ...venueData,
      coverImage: coverImageUrl,
      additionalImages: additionalImageUrls,
      createdBy: userId,
      ownerId: userId,
    });

    await venue.save();
    console.log("Venue created successfully:", venue);

    res.status(201).json(venue);
  } catch (error) {
    console.error("Error in createVenue:", error);
    res.status(500).json({
      message: "An error occurred while creating the venue",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

const getAllVenues = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      searchTerm,
      location,
      category,
      state,
      venueId,
      ownerId,
      type,
      capacity,
      priceMin,
      priceMax,
    } = req.query;

    // Build filter object
    let filter = {};

    // ID-based filters
    if (venueId) {
      // Ensure valid ObjectId
      if (mongoose.Types.ObjectId.isValid(venueId)) {
        filter._id = mongoose.Types.ObjectId(venueId);
      } else {
        return res.status(400).json({ message: "Invalid venue ID format" });
      }
    }

    if (ownerId) {
      // Ensure valid ObjectId
      if (mongoose.Types.ObjectId.isValid(ownerId)) {
        filter.ownerId = mongoose.Types.ObjectId(ownerId);
      } else {
        return res.status(400).json({ message: "Invalid owner ID format" });
      }
    }

    // Text-based filters
    if (searchTerm) {
      filter.$or = [
        { title: { $regex: searchTerm, $options: "i" } },
        { "address.area": { $regex: searchTerm, $options: "i" } },
        { "address.street": { $regex: searchTerm, $options: "i" } },
      ];
    }

    // Location-based filters
    if (state) {
      filter["address.state"] = state;
    }
    if (location) {
      filter["address.lga"] = location;
    }

    // Type and capacity filters
    if (type) {
      filter.type = type;
    }
    if (capacity) {
      filter.capacity = capacity;
    }

    // Price range filter
    if (priceMin || priceMax) {
      filter["pricingDetails.totalPayment"] = {};
      if (priceMin)
        filter["pricingDetails.totalPayment"].$gte = Number(priceMin);
      if (priceMax)
        filter["pricingDetails.totalPayment"].$lte = Number(priceMax);
    }

    // Add filter for non-blacklisted venues by default
    filter.blacklisted = { $ne: true };

    // Get total count for pagination
    const totalVenues = await Venue.countDocuments(filter);
    const totalPages = Math.ceil(totalVenues / limit);

    // Get paginated results with specified fields
    const venues = await Venue.find(filter)
      .select({
        title: 1,
        businessEmail: 1,
        businessPhoneNumbers: 1,
        capacity: 1,
        amenities: 1,
        type: 1,
        pricingDetails: 1,
        address: 1,
        coverImage: 1,
        additionalImages: 1,
        createdAt: 1,
        verified: 1,
        ownerId: 1,
        averageRating: 1,
        reviews: 1,
        totalReviews: 1,
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .exec();

    res.status(200).json({
      venues,
      totalPages,
      currentPage: Number(page),
      totalVenues,
      filter: filter, // Include filter in response for debugging
    });
  } catch (error) {
    console.error("Error in getAllVenues:", error);
    res.status(500).json({
      message: "Error fetching venues",
      error: error.message,
    });
  }
};

// Get a venue by ID
const getVenueById = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    res.status(200).json(venue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a venue
const updateVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const venueData = JSON.parse(req.body.venueData);
    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Handle cover image update
    if (req.files && req.files.coverImage) {
      await deleteFromCloudinary(venue.coverImage);
      venueData.coverImage = await uploadToCloudinary(req.files.coverImage);
    }

    // Handle additional images update
    if (req.files && req.files.additionalImages) {
      // Delete existing images
      for (const imageUrl of venue.additionalImages) {
        await deleteFromCloudinary(imageUrl);
      }

      // Upload new images
      const uploadPromises = req.files.additionalImages.map((file) =>
        uploadToCloudinary(file)
      );
      venueData.additionalImages = await Promise.all(uploadPromises);
    }

    const updatedVenue = await Venue.findByIdAndUpdate(id, venueData, {
      new: true,
    });

    res.json(updatedVenue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a venue
const deleteVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Delete cover image from Cloudinary
    if (venue.coverImage) {
      await deleteFromCloudinary(venue.coverImage);
    }

    // Delete additional images from Cloudinary
    if (venue.additionalImages && venue.additionalImages.length > 0) {
      for (const imageUrl of venue.additionalImages) {
        await deleteFromCloudinary(imageUrl);
      }
    }

    // Delete the venue from database
    await Venue.findByIdAndDelete(id);
    res.status(200).json({ message: "Venue deleted successfully" });
  } catch (error) {
    console.error("Error in deleteVenue:", error);
    res.status(500).json({
      message: "Failed to delete venue",
      error: error.message,
    });
  }
};

const removeVenueImage = async (req, res) => {
  try {
    const { venueId, imageUrl, imageType } = req.body;

    // Input validation
    if (!venueId || !imageUrl || !imageType) {
      return res.status(400).json({
        message: "Venue ID, image URL, and image type are required",
        details: {
          venueId: !venueId ? "Missing venue ID" : null,
          imageUrl: !imageUrl ? "Missing image URL" : null,
          imageType: !imageType ? "Missing image type" : null,
        },
      });
    }

    // Find the venue
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Validate the image type
    if (!["coverImage", "additionalImages"].includes(imageType)) {
      return res.status(400).json({
        message:
          "Invalid image type. Must be 'coverImage' or 'additionalImages'",
      });
    }

    // Verify the image exists in the venue document
    if (imageType === "coverImage" && venue.coverImage !== imageUrl) {
      return res.status(400).json({
        message: "Image URL does not match venue's cover image",
      });
    }
    if (
      imageType === "additionalImages" &&
      !venue.additionalImages.includes(imageUrl)
    ) {
      return res.status(400).json({
        message: "Image URL not found in venue's additional images",
      });
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(imageUrl);

    // Update the venue document based on image type
    if (imageType === "coverImage") {
      venue.coverImage = null;
    } else {
      venue.additionalImages = venue.additionalImages.filter(
        (img) => img !== imageUrl
      );
    }

    // Save the updated venue
    await venue.save();

    res.status(200).json({
      message: "Image removed successfully",
      venue,
    });
  } catch (error) {
    console.error("Error removing image:", error);
    res.status(500).json({
      message: "Failed to remove image",
      error: error.message,
    });
  }
};

const verifyVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { reason, verificationId } = req.body;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    try {
      // Update venue verification status
      venue.verified = !venue.verified;
      venue.verificationDetails = {
        verifiedAt: new Date(),
        reason:
          reason ||
          (venue.verified ? "Venue verified" : "Verification removed"),
      };
      await venue.save();

      // Update verification request status
      let verificationRequest;
      if (verificationId) {
        verificationRequest =
          await VerificationRequest.findById(verificationId);
      } else {
        // Find the latest verification request
        verificationRequest = await VerificationRequest.findOne(
          { venueId: venueId },
          null,
          { sort: { createdAt: -1 } }
        );
      }

      if (verificationRequest) {
        verificationRequest.status = venue.verified ? "approved" : "rejected";
        if (!venue.verified && reason) {
          verificationRequest.rejectionReason = reason;
        }
        verificationRequest.updatedAt = new Date();
        await verificationRequest.save();
      }

      // Create notification
      const notification = new PaymentNotification({
        userId: venue.createdBy,
        type: "VERIFICATION_STATUS",
        title: venue.verified
          ? "Venue Verification Approved"
          : "Venue Verification Rejected",
        message: venue.verified
          ? `Your venue ${venue.title} has been successfully verified.`
          : `Your venue ${venue.title} verification has been rejected.`,
        recipients: [venue.createdBy.toString()],
        relatedData: {
          venueId: venue._id,
          status: venue.verified ? "approved" : "rejected",
          reason: reason,
        },
      });

      await notification.save();

      return res.status(200).json({
        success: true,
        message: venue.verified
          ? "Venue verified successfully"
          : "Venue verification removed",
        venue: venue,
      });
    } catch (error) {
      // If any operation fails, attempt to revert venue verification status
      if (venue) {
        venue.verified = !venue.verified;
        if (venue.verificationDetails) {
          delete venue.verificationDetails;
        }
        await venue.save().catch(console.error);
      }
      throw error;
    }
  } catch (error) {
    console.error("Verify venue error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update venue verification status",
      error: error.message,
    });
  }
};
const blacklistVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { reason, duration } = req.body;

    // Validate input
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for blacklisting",
      });
    }

    // Find the venue
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    try {
      // Convert duration from days to milliseconds if provided
      const durationMs = duration ? duration * 24 * 60 * 60 * 1000 : null;

      // Update blacklist status
      venue.blacklisted = !venue.blacklisted;
      venue.blacklistDetails = {
        blacklistedAt: new Date(),
        reason: reason,
        duration: durationMs ? new Date(Date.now() + durationMs) : null,
      };
      await venue.save();

      // Create notification for blacklist status
      const notification = new PaymentNotification({
        userId: venue.createdBy,
        type: "BLACKLIST_STATUS",
        title: venue.blacklisted
          ? "Venue Blacklisted"
          : "Venue Removed from Blacklist",
        message: venue.blacklisted
          ? `Your venue ${venue.title} has been blacklisted. Reason: ${reason}`
          : `Your venue ${venue.title} has been removed from the blacklist.`,
        recipients: [venue.createdBy],
        relatedData: {
          venueId: venue._id,
          status: venue.blacklisted ? "blacklisted" : "removed",
          reason: reason,
          duration: durationMs ? new Date(Date.now() + durationMs) : null,
        },
      });

      await notification.save();

      return res.status(200).json({
        success: true,
        message: venue.blacklisted
          ? "Venue blacklisted successfully"
          : "Venue removed from blacklist",
        venue: venue,
      });
    } catch (error) {
      // If any operation fails, attempt to revert blacklist status
      if (venue) {
        venue.blacklisted = !venue.blacklisted;
        await venue.save().catch(console.error);
      }
      throw error;
    }
  } catch (error) {
    console.error("Blacklist venue error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update venue blacklist status",
      error: error.message,
    });
  }
};

module.exports = {
  createVenue,
  getAllVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
  removeVenueImage,
  verifyVenue,
  blacklistVenue,
};
