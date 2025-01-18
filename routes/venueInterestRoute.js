// routes/venueInterestRoutes.js
const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  createVenueInterest,
  getVenueInterests,
  deleteVenueInterest,
} = require("../controllers/venueInterestController");

router.post("/createVenueInterest", authmiddleware, createVenueInterest);
router.get("/getVenueInterests", authmiddleware, getVenueInterests);
router.delete("/deleteVenueInterest/:id", authmiddleware, deleteVenueInterest);

module.exports = router;
