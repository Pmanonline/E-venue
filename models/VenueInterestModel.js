// models/venueInterestModel.js
const mongoose = require("mongoose");

const venueInterestSchema = new mongoose.Schema({
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venue",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ownerId: {
    type: String,
  },
  fullName: {
    type: String,
    required: [true, "Full name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please provide a valid email"],
  },
  phoneNumber: {
    type: String,
    required: [true, "Phone number is required"],
  },
  eventDate: {
    type: Date,
    required: [true, "Event date is required"],
  },
  timeSlot: {
    type: String,
    required: [true, "Time slot is required"],
    enum: ["morning", "afternoon", "evening", "fullday"],
  },
  message: String,
  status: {
    type: String,
    enum: ["pending", "contacted", "confirmed", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("VenueInterest", venueInterestSchema);
