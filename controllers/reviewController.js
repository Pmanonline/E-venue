// controllers/reviewController.js
const Review = require("../models/reviewModel");
const Business = require("../models/businessModel");
const mongoose = require("mongoose");

const createReview = async (req, res) => {
  try {
    const { businessId, rating, comment, images, userId } = req.body;

    // Check if user has already reviewed this business
    const existingReview = await Review.findOne({ businessId, userId });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this business" });
    }

    const review = await Review.create({
      businessId,
      userId,
      rating,
      comment,
      images: images || [],
    });

    // Populate user details
    await review.populate("userId", "username profilePic");

    // Update business average rating
    await updateBusinessRating(businessId);

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBusinessReviews = async (req, res) => {
  try {
    const { businessId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ businessId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username profilePic")
      .lean();

    const total = await Review.countDocuments({ businessId });

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

    const review = await Review.findOne({ _id: id, userId });
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

    // Update business average rating
    await updateBusinessRating(review.businessId);

    await review.populate("userId", "username profilePic");
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const review = await Review.findOne({ _id: id, userId });
    if (!review) {
      return res
        .status(404)
        .json({ message: "Review not found or unauthorized" });
    }

    const businessId = review.businessId;
    await review.remove();

    // Update business average rating
    await updateBusinessRating(businessId);

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleLikeReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const review = await Review.findById(id);
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

// Helper function to update business average rating
async function updateBusinessRating(businessId) {
  const reviews = await Review.find({ businessId });
  if (reviews.length > 0) {
    const averageRating =
      reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
    await Business.findByIdAndUpdate(businessId, {
      averageRating,
      totalReviews: reviews.length,
    });
  }
}

module.exports = {
  createReview,
  getBusinessReviews,
  updateReview,
  deleteReview,
  toggleLikeReview,
};
