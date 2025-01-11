const mongoose = require("mongoose");

const verificationRequestSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Businesz",
    required: true,
  },
  businessName: {
    type: String,
    required: true,
  },
  fullAddress: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  description: String,
  documents: [
    {
      type: String,
      required: true,
    },
  ],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "VerificationRequest",
  verificationRequestSchema
);
