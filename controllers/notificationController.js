// controllers/notificationController.js
const PaymentNotification = require("../models/paymentNotificationModdel");
const paymentNotificationForAdmin = require("../models/paymentNotificationForAdmin");
const mongoose = require("mongoose");

// Get all notifications for a user
const getNotifications = async (req, res) => {
  try {
    const notifications = await PaymentNotification.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};
const getAllNotificationForAdmin = async (req, res) => {
  try {
    const notifications = await paymentNotificationForAdmin
      .find({})
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    console.log("Marking notification as read:", {
      id: req.params.id,
      userId: req.user._id,
    });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await PaymentNotification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      { $set: { isRead: true } },
      {
        new: true,
        runValidators: true,
      }
    );

    console.log("Updated notification:", notification);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Failed to update notification" });
  }
};
const markNotificationAsReadforAdmin = async (req, res) => {
  try {
    console.log("Marking notification as read:", {
      id: req.params.id,
    });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await paymentNotificationForAdmin.findOneAndUpdate(
      {
        _id: req.params.id, // Removed userId check
      },
      { $set: { isRead: true } },
      {
        new: true,
        runValidators: true,
      }
    );

    console.log("Updated notification:", notification);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await PaymentNotification.updateMany(
      {
        id: req.params.id,
        isRead: false,
      },
      { $set: { isRead: true } },
      { runValidators: true }
    );

    if (!result.acknowledged) {
      return res.status(500).json({ message: "Update operation failed" });
    }

    // Fetch updated notifications
    const updatedNotifications = await PaymentNotification.find({
      id: req.params.id,
    });

    res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
      notifications: updatedNotifications,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Failed to update notifications" });
  }
};

// for Admin
// Mark all notifications as read
const markAllNotificationsAsReadFOrAdmin = async (req, res) => {
  try {
    const result = await paymentNotificationForAdmin.updateMany(
      { isRead: false }, // No userId filter
      { $set: { isRead: true } },
      { runValidators: true }
    );

    if (!result.acknowledged) {
      return res.status(500).json({ message: "Update operation failed" });
    }

    // Fetch updated notifications
    const updatedNotifications = await paymentNotificationForAdmin.find();

    res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
      notifications: updatedNotifications,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Failed to update notifications" });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const notification = await PaymentNotification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ message: "PaymentNotification not found" });
    }

    res.json({ message: "PaymentNotification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};

// delete notifications for Admin
const deleteNotificationForAdmin = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await paymentNotificationForAdmin.findOneAndDelete({
      _id: req.params.id, // Removed userId check
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};
module.exports = {
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  markAllNotificationsAsRead,
  // for admin
  getAllNotificationForAdmin,
  markNotificationAsReadforAdmin,
  markAllNotificationsAsReadFOrAdmin,
  deleteNotificationForAdmin,
};
