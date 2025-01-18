const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");

const {
  createVenue,
  getAllVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
  removeVenueImage,
  verifyVenue,
  blacklistVenue,
} = require("../controllers/VenueController");

// Routes
router.post("/createVenue", authmiddleware, createVenue);
router.get("/getAllVenues", getAllVenues);
router.get("/getVenueById/:id", getVenueById);
router.put("/updateVenue/:id", updateVenue);
router.delete("/venues/deleteVenue/:id", deleteVenue);
router.post("/remove-Venueimage", removeVenueImage);
router.post("/venues/verify/:venueId", verifyVenue);
router.post("/venues/blacklist/:venueId", blacklistVenue);

module.exports = router;
