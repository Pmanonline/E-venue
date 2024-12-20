// / routes/reviewRoutes.js
const express = require("express");
const router = express.Router();
const {
  createReview,
  getBusinessReviews,
  updateReview,
  deleteReview,
  toggleLikeReview,
} = require("../controllers/reviewController");

router.post("/reviews", createReview);
router.get("/getBusinessReviews/:businessId", getBusinessReviews);
router.put("/reviews/:id", updateReview);
router.delete("/deleteReview/:id", deleteReview);
router.post("/toggleLikeReview/:id", toggleLikeReview);

module.exports = router;
