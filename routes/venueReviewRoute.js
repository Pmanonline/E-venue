// / routes/reviewRoutes.js
const express = require("express");
const router = express.Router();
const {
  createReview,
  getVenueReviews,
  getAllVenueReviews,
  updateReview,
  deleteReview,
  toggleLikeReview,
} = require("../controllers/venueReviewController");

router.post("/venue/reviews", createReview);
router.get("/getVenueReviews/:venueId", getVenueReviews);
router.get("/getAllVenueReviews", getAllVenueReviews);
router.put("/venue/reviews/:id", updateReview);
router.delete("/venue/deleteReview/:id", deleteReview);
router.post("/venue/toggleLikeReview/:id", toggleLikeReview);

module.exports = router;
