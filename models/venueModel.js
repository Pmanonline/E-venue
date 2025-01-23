const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  businessEmail: {
    type: String,
    required: true,
    trim: true,
  },
  businessPhoneNumbers: {
    type: [
      {
        type: String,
        trim: true,
      },
    ],
    validate: [
      {
        validator: function (phones) {
          return phones.length <= 2;
        },
        message: "Cannot have more than 2 phone numbers",
      },
    ],
  },
  capacity: {
    type: String,
    required: true,
  },
  amenities: {
    isFurnished: { type: Boolean, default: false },
    hasAC: { type: Boolean, default: false },
    hasToilet: { type: Boolean, default: false },
    hasBathroom: { type: Boolean, default: false },
    hasChangingRoom: { type: Boolean, default: false },
    toilets: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
  },
  type: {
    type: String,
    required: true,
  },
  pricingDetails: {
    totalPayment: {
      type: Number,
      required: true,
    },
    initialPayment: {
      type: Number,
      required: true,
    },

    percentage: { type: String },
    paymentDuration: {
      type: [Number], // Array of numbers representing days
      validate: {
        validator: function (durations) {
          return durations.length > 0 && durations.every((d) => d > 0);
        },
        message: "At least one valid payment duration is required",
      },
    },
  },
  address: {
    state: { type: String, required: true },
    lga: { type: String, required: true },
    area: { type: String },
    street: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  coverImage: { type: String },
  additionalImages: [{ type: String }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
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
    duration: { type: Date },
    active: { type: Boolean, default: true },
  },

  // Rating stats
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VenueReview",
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
});

// Add index for sorting by rating
venueSchema.index({ averageRating: -1, totalReviews: -1 });

// Method to get top rated venues
venueSchema.statics.getTopRated = async function (limit = 10) {
  return this.find({
    totalReviews: { $gt: 0 }, // Only include venues with reviews
  })
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(limit)
    .select("title averageRating totalReviews coverImage");
};

// Method to get venue reviews with pagination
venueSchema.methods.getReviews = async function (page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const reviews = await mongoose
    .model("VenueReview")
    .find({
      venueId: this._id,
      status: "active",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "username image");

  const total = await mongoose.model("VenueReview").countDocuments({
    venueId: this._id,
    status: "active",
  });

  return {
    reviews,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
  };
};

// Pre-save middleware to validate phone numbers
venueSchema.pre("save", function (next) {
  if (this.businessPhoneNumbers && this.businessPhoneNumbers.length > 2) {
    next(new Error("Maximum of 2 phone numbers allowed"));
  }
  next();
});

// Venue methods
venueSchema.methods.verify = async function (adminId, reason) {
  this.verified = true;
  this.verificationDetails = {
    verifiedBy: adminId,
    verifiedAt: new Date(),
    reason: reason,
  };
  await this.save();
};

venueSchema.methods.blacklist = async function (adminId, reason, duration) {
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

// Create indexes for common queries
venueSchema.index({ "address.state": 1, "address.lga": 1 });
venueSchema.index({ verified: 1 });
venueSchema.index({ blacklisted: 1 });
venueSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Venue", venueSchema);
