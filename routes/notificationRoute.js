// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../config/authMiddleware");
const {
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  markAllNotificationsAsRead,
  // for Admin
  getAllNotificationForAdmin,
  markNotificationAsReadforAdmin,
  markAllNotificationsAsReadFOrAdmin,
  deleteNotificationForAdmin,
} = require("../controllers/notificationController");

// Notification routes
router.get("/notifications/getNotifications", authMiddleware, getNotifications);
router.patch(
  "/notifications/markNotificationAsRead/:id",
  authMiddleware,
  markNotificationAsRead
);
router.delete(
  "/notifications/deleteNotification/:id",
  authMiddleware,
  deleteNotification
);
router.patch(
  "/notifications/markAllNotificationsAsRead",
  authMiddleware,
  markAllNotificationsAsRead
);

// for Admin

router.get(
  "/notifications/getAllNotificationForAdmin",
  authMiddleware,
  getAllNotificationForAdmin
);

router.patch(
  "/notifications/markNotificationAsReadforAdmin/:id",
  authMiddleware,
  markNotificationAsReadforAdmin
);
router.patch(
  "/notifications/markAllNotificationsAsReadFOrAdmin/:id",
  authMiddleware,
  markAllNotificationsAsReadFOrAdmin
);
router.delete(
  "/notifications/deleteNotificationForAdmin/:id",
  authMiddleware,
  deleteNotificationForAdmin
);

module.exports = router;
