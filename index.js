// const express = require("express");
// const path = require("path");
// const morgan = require("morgan");
// const bodyParser = require("body-parser");
// const session = require("express-session");
// const cookieParser = require("cookie-parser");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const jwt = require("jsonwebtoken");
// const connectDB = require("./config/db.config");
// const { errorHandlingMiddleware } = require("./middlewares/errorHandling.js");
// const visitTrackerMiddleware = require("./middlewares/visitsTracker.js");
// const fileUpload = require("express-fileupload");
// const fileUploadConfig = require("./config/cloudinary.js");

// // Route imports

// const Routes = require("./routes/route.js");
// const UserRoutes = require("./routes/userRoutes.js");
// const VenueRoutes = require("./routes/venueRoutes.js");
// const EventRoutes = require("./routes/eventRoutes.js");
// const BusinessRoutes = require("./routes/businessRoute.js");
// const MessageRoutes = require("./routes/messageRoute.js");
// const businessReviewRoutes = require("./routes/BusinessReviewRoute.js");
// const venueReviewRoutes = require("./routes/venueReviewRoute.js");
// const paymentRoutes = require("./routes/paymentRoute.js");
// const ticketPaymentRoute = require("./routes/ticketPaymentRoute.js");
// const notificationRoutes = require("./routes/notificationRoute.js");
// const verifcationRoutes = require("./routes/verifcationRoute.js");

// const app = express();

// // Load env vars
// dotenv.config();

// // Connect to database
// connectDB();

// // app.use(visitTrackerMiddleware);
// app.use(
//   cors({
//     origin: "http://localhost:5173", // Your frontend URL
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// // 2. Basic middleware
// app.use(morgan("dev"));
// app.options("*", cors());
// app.use(express.json({ limit: "50mb" }));
// app.use(cookieParser());
// app.use(bodyParser.json({ limit: "50mb" }));
// app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// // In your main Express app file

// const errorHandler = (err, req, res, next) => {
//   console.error(err);
//   res.status(err.status || 500).json({
//     status: false,
//     message: err.message || "Internal server error",
//   });
// };

// app.use(errorHandler);

// // 3. Session middleware (only once)
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "your_session_secret",
//     resave: false,
//     saveUninitialized: true,
//     cookie: {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//     },
//   })
// );

// // 4. Static files middleware
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use("/insertImage", express.static(path.join(__dirname, "insertImage")));
// app.use(express.static(path.join(__dirname, "public")));

// // 5. Routes
// app.use("/api", Routes);

// app.use("/api", UserRoutes);
// app.use("/api", VenueRoutes);
// app.use("/api", EventRoutes);
// app.use("/api", BusinessRoutes);
// app.use("/api", MessageRoutes);
// app.use("/api", businessReviewRoutes);
// app.use("/api", venueReviewRoutes);
// app.use("/api", paymentRoutes);
// app.use("/api", ticketPaymentRoute);
// app.use("/api", notificationRoutes);
// app.use("/api", verifcationRoutes);

// // Test route
// app.get("/", (req, res) => {
//   res.json("This API is available!!...!!");
// });

// // 6. Error handling middleware (should be last)
// app.use(errorHandlingMiddleware);

// // Server startup
// const PORT = process.env.PORT || 3001;
// const server = app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
// });

// // Handle unhandled promise rejections
// process.on("unhandledRejection", (err, promise) => {
//   console.log("Unhandled Rejection:", err.message);
//   // Close server & exit process
//   server.close(() => process.exit(1));
// });

// module.exports = app;

const express = require("express");
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
    origin: "http://localhost:5173",
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

// Test route
app.get("/", (req, res) => {
  res.json("This API is available!!...!!");
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
