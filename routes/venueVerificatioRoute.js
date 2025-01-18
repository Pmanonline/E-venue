// routes/venueVerificationRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../config/authMiddleware");

const {
  createVenueVerificationRequest,
  getVenueVerificationRequests,
  deleteVenueVerificationRequest,
  getVenueVerificationRequestByVenue,
  updateVenueVerificationStatus,
} = require("../controllers/venueVerificationController");

// Create new venue verification request
router.post(
  "/venue-verification-requests",
  authMiddleware,
  createVenueVerificationRequest
);

// Get all venue verification requests (with filtering)
router.get("/venue-verification", authMiddleware, getVenueVerificationRequests);

// Delete venue verification request
router.delete(
  "/venue-verification/:id",
  authMiddleware,
  deleteVenueVerificationRequest
);

// Get venue verification request by venue ID
router.get(
  "/venue-verification/venue/:venueId",
  authMiddleware,
  getVenueVerificationRequestByVenue
);

// Update venue verification status (admin only)
router.patch(
  "/venue-verification/:id/status",
  authMiddleware,
  updateVenueVerificationStatus
);

module.exports = router;
