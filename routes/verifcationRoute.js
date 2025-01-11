// routes/verificationRoutes.js
const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  createVerificationRequest,
  deleteVerificationRequest,
  getVerificationRequest,
  getVerificationRequestByBusiness,
} = require("../controllers/verificationController");

router.post(
  "/verification-requests",
  authmiddleware,
  createVerificationRequest
);
router.delete(
  "/deleteVerificationRequest/:id",
  authmiddleware,
  deleteVerificationRequest
);
router.get("/getVerificationRequest", authmiddleware, getVerificationRequest);
router.get(
  "/verificationRequests/business/:businessId",
  getVerificationRequestByBusiness
);

module.exports = router;
