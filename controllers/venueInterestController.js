// controllers/venueInterestController.js
const VenueInterest = require("../models/VenueInterestModel");
const paymentNotificationForAdmin = require("../models/paymentNotificationForAdmin");
const Venue = require("../models/venueModel");

// Utility function for notifications
const createNotification = async (data) => {
  try {
    const notification = new paymentNotificationForAdmin({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      recipients: data.recipients,
      relatedData: data.relatedData,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Notification creation error:", error);
    throw new Error("Failed to create notification");
  }
};

// Create venue interest
const createVenueInterest = async (req, res) => {
  try {
    const {
      venueId,
      fullName,
      email,
      phoneNumber,
      eventDate,
      timeSlot,
      message,
    } = req.body;

    // Validate required fields
    if (
      !venueId ||
      !fullName ||
      !email ||
      !phoneNumber ||
      !eventDate ||
      !timeSlot
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Create venue interest
    const venueInterest = new VenueInterest({
      venueId,
      userId: req.user._id,
      fullName,
      email,
      phoneNumber,
      eventDate,
      timeSlot,
      message,
    });

    await venueInterest.save();

    // Create notification for admin
    await createNotification({
      userId: req.user._id,
      type: "VENUE_INTEREST",
      title: "New Venue Interest",
      message: `New interest request for venue: ${venue.title}`,
      recipients: ["admin"],
      relatedData: {
        interestId: venueInterest._id,
        venueName: venue.title,
        eventDate,
        timeSlot,
      },
    });

    res.status(201).json({
      success: true,
      message: "Venue interest submitted successfully",
      venueInterest,
    });
  } catch (error) {
    console.error("Create venue interest error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit venue interest",
      error: error.message,
    });
  }
};

// Get venue interests
const getVenueInterests = async (req, res) => {
  try {
    const { venueId, status, startDate, endDate } = req.query;
    const query = {};

    // Build query
    if (venueId) query.venueId = venueId;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.eventDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Non-admin users can only view their own interests
    if (req.user.role !== "admin") {
      query.userId = req.user._id;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await VenueInterest.countDocuments(query);
    const interests = await VenueInterest.find(query)
      .populate("venueId", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: interests.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      interests,
    });
  } catch (error) {
    console.error("Get venue interests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve venue interests",
      error: error.message,
    });
  }
};

// Delete venue interest
const deleteVenueInterest = async (req, res) => {
  try {
    const { id } = req.params;

    const interest = await VenueInterest.findById(id);
    if (!interest) {
      return res.status(404).json({
        success: false,
        message: "Venue interest not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      interest.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this interest",
      });
    }

    await VenueInterest.findByIdAndDelete(id);

    // Create notification for user
    await createNotification({
      userId: interest.userId,
      type: "VENUE_INTEREST_DELETED",
      title: "Venue Interest Deleted",
      message: "Your venue interest request has been deleted",
      recipients: [interest.userId],
      relatedData: {
        venueId: interest.venueId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Venue interest deleted successfully",
    });
  } catch (error) {
    console.error("Delete venue interest error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete venue interest",
      error: error.message,
    });
  }
};

module.exports = {
  createVenueInterest,
  getVenueInterests,
  deleteVenueInterest,
};
