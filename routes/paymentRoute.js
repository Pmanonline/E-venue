// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  initializePayment,
  verifyPayment,
  createPaymentNotification,
  getBookingByReference,
} = require("../controllers/paymentController");

// Payment routes
router.post("/initialize", authmiddleware, initializePayment);
router.get("/payment/verify", verifyPayment);
router.get("/payment/booking/:reference", getBookingByReference);

module.exports = router;
