const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");

const {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  removeBusinessImage,
  verifyBusiness,
  blacklistBusiness,
  getBusinessBySlug,
  recordBusinessView,
} = require("../controllers/businessController");

// Routes
router.post("/createBusiness", authmiddleware, createBusiness);
router.get("/getAllBusinesses", getAllBusinesses);
router.get("/getBusinessById/:id", getBusinessById);
router.get("/getBusinessBySlug/:slug", getBusinessBySlug);
router.put("/updateBusiness/:slug", updateBusiness);
router.delete("/deleteBusiness/:id", deleteBusiness);
router.post("/remove-image", removeBusinessImage);
router.post("/verify/:businessId", verifyBusiness);
router.post("/blacklist/:businessId", blacklistBusiness);
router.post("/recordBusinessView/:slug", recordBusinessView);

module.exports = router;
