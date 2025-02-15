// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  initializePayment,
  verifyPayment,
  getVenueBookingByRef,
  getBookingByReference,
  getAllBookings,
} = require("../controllers/paymentController");

// Payment routes
router.post("/initialize", authmiddleware, initializePayment);
router.get("/payment/verify", verifyPayment);
router.get("/booking/:reference", getVenueBookingByRef);
router.get("/payment/booking/:reference", getBookingByReference);
router.get("/getAllBookings", getAllBookings);

module.exports = router;
