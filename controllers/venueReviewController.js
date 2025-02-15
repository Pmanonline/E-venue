const VenueReview = require("../models/venueReviewModel");
const Venue = require("../models/venueModel");
const mongoose = require("mongoose");

const createReview = async (req, res) => {
  try {
    const { venueId, rating, comment, images, userId } = req.body;

    // Check if user has already reviewed this venue
    const existingReview = await VenueReview.findOne({ venueId, userId });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this venue" });
    }

    const review = await VenueReview.create({
      venueId,
      userId,
      rating,
      comment,
      images: images || [],
    });

    // Populate user details
    await review.populate("userId", "username image");

    // Update venue average rating
    await updateVenueRating(venueId);

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVenueReviews = async (req, res) => {
  try {
    const { venueId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await VenueReview.find({ venueId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username image")
      .lean();

    const total = await VenueReview.countDocuments({ venueId });

    res.json({
      reviews,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all venue reviews with pagination and population
const getAllVenueReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Find all reviews with populated fields
    const reviews = await VenueReview.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username image")
      .populate("venueId", "title")
      .lean();

    // Get total count for pagination
    const total = await VenueReview.countDocuments();

    res.json({
      reviews,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, images, userId } = req.body;

    const review = await VenueReview.findOne({ _id: id, userId });
    if (!review) {
      return res
        .status(404)
        .json({ message: "Review not found or unauthorized" });
    }

    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    review.images = images || review.images;
    review.isEdited = true;
    await review.save();

    // Update venue average rating
    await updateVenueRating(review.venueId);

    await review.populate("userId", "username profilePic");
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await VenueReview.findById(id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const venueId = review.venueId;

    // Using deleteOne() instead of remove()
    await VenueReview.deleteOne({ _id: id });

    // Update venue average rating
    await updateVenueRating(venueId);

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleLikeReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const review = await VenueReview.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const likeIndex = review.likes.indexOf(userId);
    if (likeIndex === -1) {
      review.likes.push(userId);
    } else {
      review.likes.splice(likeIndex, 1);
    }

    await review.save();
    res.json({ likes: review.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to update venue average rating
async function updateVenueRating(venueId) {
  const reviews = await VenueReview.find({ venueId });
  if (reviews.length > 0) {
    const averageRating =
      reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
    await Venue.findByIdAndUpdate(venueId, {
      averageRating,
      totalReviews: reviews.length,
    });
  }
}

module.exports = {
  createReview,
  getVenueReviews,
  getAllVenueReviews,
  updateReview,
  deleteReview,
  toggleLikeReview,
};
