const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  createServiceInterest,
  getServiceInterests,
  deleteServiceInterest,
} = require("../controllers/serviceInterestController");
 
router.post("/createServiceBooking", authmiddleware, createServiceInterest);
router.get("/getServiceBooking", authmiddleware, getServiceInterests);
router.delete("/deleteServiceBooking/:id", authmiddleware, deleteServiceInterest);

module.exports = router;