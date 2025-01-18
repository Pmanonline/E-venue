const mongoose = require("mongoose");

const venueVerificationRequestSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
  },
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venue",
    required: true,
  },
  venueName: {
    type: String,
    required: true,
  },
  capacity: {
    type: String,
    required: true,
  },
  address: {
    state: { type: String, required: true },
    lga: { type: String, required: true },
    area: { type: String },
    street: { type: String, required: true },
  },
  ownerEmail: {
    type: String,
    required: true,
  },
  ownerPhone: {
    type: String,
    required: true,
  },
  description: String,
  // Array of document URLs (ownership proof, licenses, etc.)
  documents: [
    {
      type: String,
      required: true,
    },
  ],
  // Additional verification fields specific to venues
  safetyDocuments: [
    {
      type: String,
      description: String,
    },
  ],
  inspectionDate: {
    type: Date,
  },
  inspectionNotes: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in_review", "approved", "rejected"],
    default: "pending",
  },
  rejectionReason: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
venueVerificationRequestSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model(
  "VenueVerificationRequest",
  venueVerificationRequestSchema
);
