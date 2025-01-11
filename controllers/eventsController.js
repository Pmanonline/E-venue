const Event = require("../models/eventsModel");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (file, folder = "events") => {
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

const createEvent = async (req, res) => {
  try {
    console.log("Incoming request details:");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    if (!req.body) {
      return res.status(400).json({
        message: "No request body received",
        details: "Request body is empty or malformed",
      });
    }

    let eventData;
    try {
      eventData = JSON.parse(req.body.eventData);
    } catch (error) {
      console.error("Error parsing eventData:", error);
      return res.status(400).json({ message: "Invalid eventData format" });
    }

    // Get ownerId from authenticated user
    const ownerId = req.user._id;
    if (!ownerId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Handle image uploads
    let coverImageUrl = null;
    if (req.files?.coverImage) {
      coverImageUrl = await uploadToCloudinary(req.files.coverImage);
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
    }

    // Create event instance
    const event = new Event({
      ...eventData,
      ownerId,
      isPaidEvent: eventData.price > 0,
      coverImage: coverImageUrl,
      additionalImages: additionalImageUrls,
    });

    // Generate tickets if purchase limit is set
    if (event.ticketPurchaseLimit > 0) {
      const totalTickets = event.ticketPurchaseLimit;
      event.tickets = Array.from({ length: totalTickets }, (_, index) => ({
        ticketId: Event.generateTicketId(event._id, index),
        isTaken: false,
        userId: null,
        purchaseDate: null,
      }));
      event.availableTickets = totalTickets;
    }

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    console.error("Error in createEvent:", error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const checkTicketAvailability = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const availability = event.checkAvailability();
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const reserveTicket = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const ticket = await event.reserveTicket(userId);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const { searchTerm, location, category, state } = req.query; // Add state to the destructured query
    let events = await Event.find();

    if (searchTerm) {
      events = events.filter((event) =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (location) {
      events = events.filter((event) => event.location === location);
    }

    if (category) {
      events = events.filter((event) => event.eventType === category);
    }

    if (state) {
      // Add filtering by state
      events = events.filter((event) => event.state === state);
    }

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get an event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = JSON.parse(req.body.eventData);
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Handle cover image update
    if (req.files && req.files.coverImage) {
      await deleteFromCloudinary(event.coverImage);
      eventData.coverImage = await uploadToCloudinary(req.files.coverImage);
    }

    // Handle additional images update
    if (req.files && req.files.additionalImages) {
      // Delete existing images
      for (const imageUrl of event.additionalImages) {
        await deleteFromCloudinary(imageUrl);
      }

      // Upload new images
      const additionalImages = Array.isArray(req.files.additionalImages)
        ? req.files.additionalImages
        : [req.files.additionalImages];

      const uploadPromises = additionalImages.map((file) =>
        uploadToCloudinary(file)
      );
      eventData.additionalImages = await Promise.all(uploadPromises);
    }

    const updatedEvent = await Event.findByIdAndUpdate(id, eventData, {
      new: true,
    });

    res.json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Delete cover image from Cloudinary
    if (event.coverImage) {
      await deleteFromCloudinary(event.coverImage);
    }

    // Delete additional images from Cloudinary
    if (event.additionalImages && event.additionalImages.length > 0) {
      for (const imageUrl of event.additionalImages) {
        await deleteFromCloudinary(imageUrl);
      }
    }

    // Delete the event from database
    await Event.findByIdAndDelete(id);
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error in deleteEvent:", error);
    res.status(500).json({
      message: "Failed to delete event",
      error: error.message,
    });
  }
};

module.exports = {
  createEvent,
  checkTicketAvailability,
  reserveTicket,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};
