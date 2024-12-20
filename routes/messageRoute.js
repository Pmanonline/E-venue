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
} = require("../controllers/messageController");

// router.use(authenticate);

router.get("/messages", getMessages);
router.post("/messages", sendMessage);
router.delete("/messages/:messageId/users/:userId", deleteMessage);
router.get("/messages/unread/:userId", getUnreadCount);
router.get("/conversations/:userId", getConversations);
router.get("/conversation", getConversationBetweenUsers);
router.post("/conversations/check", createOrGetConversation);

module.exports = router;
