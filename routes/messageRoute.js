// messageRoutes.js
const express = require("express");
const router = express.Router();
// const { authenticate } = require("../middleware/auth");

const {
  getMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
  getConversations,
  getConversationBetweenUsers,
  createOrGetConversation,
  markMessageAsDelivered,
  updateTypingStatus,
} = require("../controllers/messageController");

// router.use(authenticate);

// Message operations
router.get("/messages", getMessages);
router.post("/messages", sendMessage);
router.delete("/messages/:messageId/users/:userId", deleteMessage);
router.get("/messages/unread/:userId", getUnreadCount);

// Conversation operations
router.get("/conversations/:userId", getConversations);
router.get("/conversation", getConversationBetweenUsers);
router.post("/conversations/check", createOrGetConversation);

// New routes for message status
router.put("/messages/:messageId/deliver", markMessageAsDelivered);
router.post("/typing-status", updateTypingStatus);

module.exports = router;
