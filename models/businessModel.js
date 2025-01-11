const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  name: { type: String, required: true },
  type: { type: String, required: true },
  address: {
    state: { type: String },
    lga: { type: String },
    street: { type: String },
  },
  phoneNumber: { type: String },
  email: { type: String },
  yearsOfExperience: { type: Number },
  bio: { type: String },
  coverImage: { type: String },
  additionalImages: [{ type: String }],
  openingHours: {
    monday: { type: String },
    tuesday: { type: String },
    wednesday: { type: String },
    thursday: { type: String },
    friday: { type: String },
    saturday: { type: String },
    sunday: { type: String },
  },
  verified: { type: Boolean, default: false },
  verificationDetails: {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    reason: { type: String },
  },
  blacklisted: { type: Boolean, default: false },
  blacklistDetails: {
    blacklistedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    blacklistedAt: { type: Date },
    reason: { type: String },
    duration: { type: Date }, // Optional: When the blacklist should end
    active: { type: Boolean, default: true },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// Method to verify a business
businessSchema.methods.verify = async function (adminId, reason) {
  this.verified = true;
  this.verificationDetails = {
    verifiedBy: adminId,
    verifiedAt: new Date(),
    reason: reason,
  };
  await this.save();
};

// Method to blacklist a business
businessSchema.methods.blacklist = async function (adminId, reason, duration) {
  this.blacklisted = true;
  this.blacklistDetails = {
    blacklistedBy: adminId,
    blacklistedAt: new Date(),
    reason: reason,
    duration: duration ? new Date(Date.now() + duration) : null,
    active: true,
  };
  await this.save();
};

// Method to remove blacklist
businessSchema.methods.removeBlacklist = async function (adminId, reason) {
  this.blacklisted = false;
  this.blacklistDetails.active = false;
  await this.save();
};

module.exports = mongoose.model("Businesz", businessSchema);
