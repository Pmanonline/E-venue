const Message = require("../models/messageModel");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const getMessages = async (req, res) => {
  try {
    const { userId, recipientId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: recipientId },
        { senderId: recipientId, receiverId: userId },
      ],
      isDeleted: false,
    })
      .populate("senderId", "username email profilePic lastSeen")
      .populate("receiverId", "username email profilePic lastSeen")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        receiverId: userId,
        senderId: recipientId,
        isRead: false,
      },
      { $set: { isRead: true, deliveryStatus: "read" } }
    );

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: userId, receiverId: recipientId },
        { senderId: recipientId, receiverId: userId },
      ],
      isDeleted: false,
    });

    res.json({
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const {
      senderId,
      receiverId,
      content,
      contentType = "text",
      fileUrl,
    } = req.body;

    const message = new Message({
      senderId,
      receiverId,
      content,
      contentType,
      fileUrl,
    });

    await message.save();

    // Populate sender and receiver details before sending response
    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "username email ")
      .populate("receiverId", "username email ");

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Error sending message" });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId, userId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.isDeleted = true;
    await message.save();

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Error deleting message" });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ message: "Error getting unread count" });
  }
};

const getConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Convert userId to ObjectId correctly
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Find all messages where user is either sender or receiver
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
          isDeleted: false,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$senderId", userObjectId] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", userObjectId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "otherUser",
        },
      },
      {
        $unwind: "$otherUser",
      },
      {
        $project: {
          otherUser: {
            _id: 1,
            username: 1,
            email: 1,
            profilePic: 1,
          },
          lastMessage: 1,
          unreadCount: 1,
        },
      },
    ]);

    // Check if conversations were found
    if (conversations.length === 0) {
      return res
        .status(200)
        .json({ message: "No conversations found", conversations: [] });
    }

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

// Get conversation between two specific users
const getConversationBetweenUsers = async (req, res) => {
  try {
    // Support both query and params for flexibility
    const userId = req.query.userId || req.params.userId;
    const otherUserId = req.query.otherUserId || req.params.otherUserId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Validate the user IDs
    if (!userId || !otherUserId) {
      return res.status(400).json({
        message: "Both userId and otherUserId are required",
      });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID format",
      });
    }

    const skip = (page - 1) * limit;

    // Find messages between the two users
    const messages = await Message.find({
      $or: [
        {
          senderId: new ObjectId(userId),
          receiverId: new ObjectId(otherUserId),
        },
        {
          senderId: new ObjectId(otherUserId),
          receiverId: new ObjectId(userId),
        },
      ],
      isDeleted: false,
    })
      .populate("senderId", "username email profilePic")
      .populate("receiverId", "username email profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // If no messages found
    if (messages.length === 0) {
      return res.json({
        messages: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalMessages: 0,
        },
        participants: {
          user1: { _id: userId },
          user2: { _id: otherUserId },
        },
      });
    }

    // Mark unread messages as read
    await Message.updateMany(
      {
        senderId: new ObjectId(otherUserId),
        receiverId: new ObjectId(userId),
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          deliveryStatus: "read",
          updatedAt: new Date(),
        },
      }
    );

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({
      $or: [
        {
          senderId: new ObjectId(userId),
          receiverId: new ObjectId(otherUserId),
        },
        {
          senderId: new ObjectId(otherUserId),
          receiverId: new ObjectId(userId),
        },
      ],
      isDeleted: false,
    });

    res.json({
      messages: messages.map((msg) => ({
        _id: msg._id,
        content: msg.content,
        contentType: msg.contentType,
        fileUrl: msg.fileUrl,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        isRead: msg.isRead,
        deliveryStatus: msg.deliveryStatus,
        timestamp: msg.timestamp,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
      },
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      message: "Error fetching conversation",
      error: error.message,
    });
  }
};

const createOrGetConversation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // Validate user IDs
    if (!ObjectId.isValid(senderId) || !ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Check if a conversation already exists
    const existingConversation = await Message.findOne({
      $or: [
        {
          senderId: new ObjectId(senderId),
          receiverId: new ObjectId(receiverId),
        },
        {
          senderId: new ObjectId(receiverId),
          receiverId: new ObjectId(senderId),
        },
      ],
      isDeleted: false,
    });

    if (existingConversation) {
      // Conversation exists, return success
      return res.status(200).json({
        message: "Conversation already exists",
        conversation: {
          receiverId:
            existingConversation.senderId === senderId
              ? existingConversation.receiverId
              : existingConversation.senderId,
        },
      });
    }

    // If no conversation exists, return a response indicating a new conversation can be created
    res.status(201).json({
      message: "New conversation can be created",
      conversation: {
        receiverId: new ObjectId(receiverId),
      },
    });
  } catch (error) {
    console.error("Error checking/creating conversation:", error);
    res.status(500).json({
      message: "Error checking/creating conversation",
      error: error.message,
    });
  }
};

// Add to messageController.js:
const markMessageAsDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    await Message.findByIdAndUpdate(messageId, {
      deliveryStatus: "delivered",
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error updating message status" });
  }
};

const updateTypingStatus = async (req, res) => {
  try {
    const { userId, receiverId, isTyping } = req.body;
    // Emit through socket
    io.to(receiverId).emit(
      isTyping ? "typing_started" : "typing_stopped",
      userId
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error updating typing status" });
  }
};
module.exports = {
  getMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
  getConversations,
  getConversationBetweenUsers,
  createOrGetConversation,
  markMessageAsDelivered,
  updateTypingStatus,
};
