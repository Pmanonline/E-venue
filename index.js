const express = require("express");
const axios = require("axios");
const path = require("path");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const http = require("http"); // Add this import
const connectDB = require("./config/db.config");
const { errorHandlingMiddleware } = require("./middlewares/errorHandling.js");
const initializeSocket = require("./config/socket.js");
const Booking = require("./models/bookingModel.js");

// Route imports
const Routes = require("./routes/route.js");
const UserRoutes = require("./routes/userRoutes.js");
const VenueRoutes = require("./routes/venueRoutes.js");
const EventRoutes = require("./routes/eventRoutes.js");
const BusinessRoutes = require("./routes/businessRoute.js");
const MessageRoutes = require("./routes/messageRoute.js");
const businessReviewRoutes = require("./routes/BusinessReviewRoute.js");
const venueReviewRoutes = require("./routes/venueReviewRoute.js");
const paymentRoutes = require("./routes/paymentRoute.js");
const ticketPaymentRoute = require("./routes/ticketPaymentRoute.js");
const notificationRoutes = require("./routes/notificationRoute.js");
const verifcationRoutes = require("./routes/verifcationRoute.js");
const venueVerificatioRoute = require("./routes/venueVerificatioRoute.js");
const venueInterestRoute = require("./routes/venueInterestRoute.js");
const serviceInterestRoute = require("./routes/serviceInterestRoute.js");

// Load env vars
dotenv.config();

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Connect to database
connectDB();

// Initialize Socket.IO
const io = initializeSocket(server);

// Make io instance available throughout the application
app.set("socketio", io);

// Middleware setup
app.use(
  cors({
    origin: ["http://localhost:5173", "https://evenue.ng"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(morgan("dev"));
app.options("*", cors());
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Error handler
const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    status: false,
    message: err.message || "Internal server error",
  });
};

app.use(errorHandler);

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  })
);

// Static files middleware
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/insertImage", express.static(path.join(__dirname, "insertImage")));
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api", Routes);
app.use("/api", UserRoutes);
app.use("/api", VenueRoutes);
app.use("/api", EventRoutes);
app.use("/api", BusinessRoutes);
app.use("/api", MessageRoutes);
app.use("/api", businessReviewRoutes);
app.use("/api", venueReviewRoutes);
app.use("/api", paymentRoutes);
app.use("/api", ticketPaymentRoute);
app.use("/api", notificationRoutes);
app.use("/api", verifcationRoutes);
app.use("/api", venueVerificatioRoute);
app.use("/api", venueInterestRoute);
app.use("/api", serviceInterestRoute);

// Test route
app.get("/", (req, res) => {
  res.json("This API is available!!...!!");
});

// getting nearBy location
// In your backend
app.post("/api/nearby-places", async (req, res) => {
  const { lat, lng, radius, type } = req.body;

  // Add validation
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "Latitude and Longitude are required" });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    );
    const data = await response.json();

    // Log the response for debugging
    console.log("Google Places API Response:", data);

    res.json(data);
  } catch (error) {
    console.error("Nearby Places Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch nearby places" });
  }
});

app.post("/api/geocode", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const googleMapsApiKey = "YOUR_GOOGLE_MAPS_API_KEY"; // Ensure this is set correctly
    if (!googleMapsApiKey) {
      console.error("Google Maps API Key is missing");
      return res.status(500).json({ error: "API configuration error" });
    }

    const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;

    const response = await axios.get(googleGeocodeUrl);

    if (response.data.status === "OK" && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;

      return res.json({
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: response.data.results[0].formatted_address,
      });
    } else {
      console.error("Geocoding response status:", response.data.status);
      return res
        .status(404)
        .json({ error: "Could not geocode address", details: response.data });
    }
  } catch (error) {
    console.error("Geocoding server error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// Error handling middleware
app.use(errorHandlingMiddleware);

// Server startup - Use the HTTP server instead of app
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log("Unhandled Rejection:", err.message);
  server.close(() => process.exit(1));
});

module.exports = { app, io }; // Export both app and io
module.exports = app;
