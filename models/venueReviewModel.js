// models/Review.js
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    images: [
      {
        type: String,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
// reviewSchema.index({ venueId: 1, createdAt: -1 });

// const Review = mongoose.model("VenueReview", reviewSchema);
// module.exports = Review;

// Indexes for efficient queries
reviewSchema.index({ venueId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, venueId: 1 }, { unique: true });
reviewSchema.index({ status: 1 });

// Middleware to update venue ratings after saving a review
reviewSchema.post("save", async function () {
  const Venue = mongoose.model("Venue");
  const venue = await Venue.findById(this.venueId);

  if (venue) {
    // Get all active reviews for this venue
    const reviews = await this.constructor.find({
      venueId: this.venueId,
      status: "active",
    });

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Update venue with new rating data
    venue.reviews.push(this._id);
    venue.averageRating = Number(averageRating.toFixed(1));
    venue.totalReviews = reviews.length;

    await venue.save();
  }
});

// Middleware to update venue ratings after deleting a review
reviewSchema.post("remove", async function () {
  const Venue = mongoose.model("Venue");
  const venue = await Venue.findById(this.venueId);

  if (venue) {
    // Remove this review from venue's reviews array
    venue.reviews = venue.reviews.filter(
      (review) => review.toString() !== this._id.toString()
    );

    // Get remaining active reviews
    const reviews = await this.constructor.find({
      venueId: this.venueId,
      status: "active",
    });

    // Recalculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Update venue
    venue.averageRating = Number(averageRating.toFixed(1));
    venue.totalReviews = reviews.length;

    await venue.save();
  }
});

const VenueReview = mongoose.model("VenueReview", reviewSchema);

module.exports = VenueReview;
