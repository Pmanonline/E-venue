// routes/venueInterestRoutes.js
const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  createVenueInterest,
  getVenueInterests,
  getOwnerVenueInterests,
  deleteVenueInterest,
  updateVenueInterestStatus,
} = require("../controllers/venueInterestController");

router.post("/createVenueInterest", authmiddleware, createVenueInterest);
router.get("/getVenueInterests", authmiddleware, getVenueInterests);
router.get("/getOwnerVenueInterests", authmiddleware, getOwnerVenueInterests);
router.delete("/deleteVenueInterest/:id", authmiddleware, deleteVenueInterest);
router.patch(
  "/updateVenueInterestStatus/:id",
  authmiddleware,
  updateVenueInterestStatus
);

module.exports = router;
