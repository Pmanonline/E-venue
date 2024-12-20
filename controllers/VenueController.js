const Venue = require("../models/venueModel");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

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

const createVenue = async (req, res) => {
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

    // Initialize coverImageUrl as null
    let coverImageUrl = null;

    // Upload cover image if provided
    if (req.files && req.files.coverImage) {
      coverImageUrl = await uploadToCloudinary(req.files.coverImage);
      console.log("Cover image uploaded:", coverImageUrl);
    } else {
      console.log("No cover image provided, proceeding without it.");
    }

    // Upload additional images if any
    let additionalImageUrls = [];
    if (req.files && req.files.additionalImages) {
      const additionalImages = Array.isArray(req.files.additionalImages)
        ? req.files.additionalImages
        : [req.files.additionalImages];

      for (const image of additionalImages) {
        try {
          const url = await uploadToCloudinary(image);
          additionalImageUrls.push(url);
        } catch (error) {
          console.error("Error uploading additional image:", error);
          // Continue with other images even if one fails
        }
      }
      console.log("Additional images uploaded:", additionalImageUrls);
    }

    const venue = new Venue({
      ...venueData,
      coverImage: coverImageUrl, // This can be null if no image was uploaded
      additionalImages: additionalImageUrls,
    });

    await venue.save();
    res.status(201).json(venue);
  } catch (error) {
    console.error("Error in createVenue:", error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
// Get all venues
// const getAllVenues = async (req, res) => {
//   try {
//     const venues = await Venue.find();
//     res.status(200).json(venues);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
const getAllVenues = async (req, res) => {
  try {
    const { searchTerm, location, category, state } = req.query; // Add state to the destructured query
    let venues = await Venue.find();

    if (searchTerm) {
      venues = venues.filter((venue) =>
        venue.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (location) {
      venues = venues.filter((venue) => venue.location === location);
    }

    if (category) {
      venues = venues.filter((venue) => venue.category === category);
    }

    if (state) {
      // Add filtering by state
      venues = venues.filter((venue) => venue.address.state === state);
    }

    res.status(200).json(venues);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

module.exports = {
  createVenue,
  getAllVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
  removeVenueImage,
};
