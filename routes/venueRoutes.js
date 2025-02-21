const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");

const {
  createVenue,
  getAllVenues,
  getVenueById,
  getVenueBySlug,
  updateVenue,
  deleteVenue,
  removeVenueImage,
  verifyVenue,
  blacklistVenue,
  recordVenueView,
} = require("../controllers/VenueController");

// Routes
router.post("/createVenue", authmiddleware, createVenue);
router.get("/getAllVenues", getAllVenues);
router.get("/getVenueById/:id", getVenueById);
router.get("/getVenueBySlug/:slug", getVenueBySlug);
router.put("/updateVenue/:slug", updateVenue);
router.delete("/venues/deleteVenue/:id", deleteVenue);
router.post("/remove-Venueimage", removeVenueImage);
router.post("/venues/verify/:venueId", verifyVenue);
router.post("/venues/blacklist/:venueId", blacklistVenue);
router.post("/venues/view/:slug", recordVenueView);

module.exports = router;
