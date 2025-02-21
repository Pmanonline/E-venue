const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  name: { type: String, required: true },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  // Add review-related fields
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  lastViewed: {
    type: Date,
    default: Date.now,
  },
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
// Add indexes for improved performance
businessSchema.index({ averageRating: -1, totalReviews: -1 });
businessSchema.index({ slug: 1 }, { unique: true });

// Add review-related methods
businessSchema.methods.getReviews = async function (page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const reviews = await mongoose
    .model("Review")
    .find({
      businessId: this._id,
      status: "active",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "username image");

  const total = await mongoose.model("Review").countDocuments({
    businessId: this._id,
    status: "active",
  });

  return {
    reviews,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
  };
};

// Method to get top rated businesses
businessSchema.statics.getTopRated = async function (limit = 10) {
  return this.find({
    totalReviews: { $gt: 0 },
  })
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(limit)
    .select("name averageRating totalReviews coverImage");
};
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
