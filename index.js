const express = require("express");
const path = require("path");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db.config");
const { errorHandlingMiddleware } = require("./middlewares/errorHandling.js");
const visitTrackerMiddleware = require("./middlewares/visitsTracker.js");
const fileUpload = require("express-fileupload");
const fileUploadConfig = require("./config/cloudinary.js");

// Route imports

const Routes = require("./routes/route.js");
const UserRoutes = require("./routes/userRoutes.js");
const VenueRoutes = require("./routes/venueRoutes.js");
const EventRoutes = require("./routes/eventRoutes.js");
const BusinessRoutes = require("./routes/businessRoute.js");
const MessageRoutes = require("./routes/messageRoute.js");
const ReviewRoutes = require("./routes/reviewRoute.js");

const app = express();

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// app.use(visitTrackerMiddleware);

// CORS Configuration
const corsOptions = {
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  // exposedHeaders: ["Content-Range", "X-Content-Range"],
  credentials: false, // Explicitly set to false
};
app.use(morgan("dev"));

// 2. Basic middleware
app.use(cors(corsOptions));
app.options("*", cors());
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// 3. Session middleware (only once)
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

// 4. Static files middleware
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/insertImage", express.static(path.join(__dirname, "insertImage")));
app.use(express.static(path.join(__dirname, "public")));

// 5. Routes
app.use("/api", Routes);

app.use("/api", UserRoutes);
app.use("/api", VenueRoutes);
app.use("/api", EventRoutes);
app.use("/api", BusinessRoutes);
app.use("/api", MessageRoutes);
app.use("/api", ReviewRoutes);
// app.use("/api", PostsRoutes);
// app.use("/api/visits", visitRoutes);

// Test route
app.get("/", (req, res) => {
  res.json("This API is available!!...!!");
});

// 6. Error handling middleware (should be last)
app.use(errorHandlingMiddleware);

// Server startup
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log("Unhandled Rejection:", err.message);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
