// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const path = require("path");

// // Import controller functions
// const {
// createVenue,
// getAllVenues,
// getVenueById,
// updateVenue,
// deleteVenue,
// } = require("../controllers/VenueController");

// // Configure multer storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/");
//   },
//   filename: (req, file, cb) => {
//     console.log("Saving file with name:", file.originalname);
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });

// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 50 * 1024 * 1024 }, // Increased limit to 50MB for video
//   fileFilter: (req, file, cb) => {
//     checkFileType(file, cb);
//   },
// });

// const checkFileType = (file, cb) => {
//   const imageFileTypes = /jpeg|jpg|png|gif|svg/;
//   const videoFileTypes = /mp4|mov|avi|wmv/;

//   // Check file extension
//   const extName = path.extname(file.originalname).toLowerCase();

//   // Check MIME type
//   if (file.fieldname === "videoClip") {
//     if (videoFileTypes.test(extName) && /video/.test(file.mimetype)) {
//       return cb(null, true);
//     } else {
//       cb("Error: You can only upload video files (mp4, mov, avi, wmv)!");
//     }
//   } else {
//     if (imageFileTypes.test(extName) && /image/.test(file.mimetype)) {
//       return cb(null, true);
//     } else {
//       cb("Error: You can only upload image files (jpeg, jpg, png, gif, svg)!");
//     }
//   }
// };

// // Define the route for creating a post with multiple file uploads
// router.post(
//   "/createVenue",
//   upload.fields([
//     { name: "coverImage", maxCount: 1 },
//     { name: "additionalImages", maxCount: 5 },
//   ]),
//   createVenue
// );
// router.get("/getAllVenues", getAllVenues);
// router.get("/getVenueById/:id", getVenueById);
// router.put(
//   "/updateVenue/:id",
//   upload.fields([
//     { name: "coverImage", maxCount: 1 },
//     { name: "additionalImages", maxCount: 5 },
//   ]),
//   updateVenue
// );
// router.delete("/deleteVenue/:id", deleteVenue);

// module.exports = router;

const express = require("express");
const router = express.Router();

const {
  createVenue,
  getAllVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
  removeVenueImage,
} = require("../controllers/VenueController");

// Routes
router.post("/createVenue", createVenue);
router.get("/getAllVenues", getAllVenues);
router.get("/getVenueById/:id", getVenueById);
router.put("/updateVenue/:id", updateVenue);
router.delete("/deleteVenue/:id", deleteVenue);
router.post("/remove-Venueimage", removeVenueImage);

module.exports = router;
