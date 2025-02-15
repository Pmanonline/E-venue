// / routes/reviewRoutes.js
const express = require("express");
const router = express.Router();
const {
  createReview,
  getBusinessReviews,
  getAllBusinessReviews,
  updateReview,
  deleteReview,
  toggleLikeReview,
} = require("../controllers/BusinessReviewController");

router.post("/reviews", createReview);
router.get("/getBusinessReviews/:businessId", getBusinessReviews);
router.get("/getAllBusinessReviews", getAllBusinessReviews);
router.put("/reviews/:id", updateReview);
router.delete("/deleteReview/:id", deleteReview);
router.post("/toggleLikeReview/:id", toggleLikeReview);

module.exports = router;
