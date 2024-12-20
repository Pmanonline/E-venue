// socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const setupSocket = (server, corsOptions) => {
  const io = new Server(server, {
    cors: corsOptions,
    pingTimeout: 60000,
  });

  let onlineUsers = new Map();

  const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  };

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Add new user
    socket.on("addNewUser", (userId) => {
      onlineUsers.set(userId, {
        socketId: socket.id,
        lastSeen: new Date(),
        status: "online",
      });

      io.emit("getOnlineUsers", Array.from(onlineUsers.entries()));
    });

    // Handle user status
    socket.on("setUserStatus", ({ status, userId }) => {
      const userInfo = onlineUsers.get(userId);
      if (userInfo) {
        userInfo.status = status;
        onlineUsers.set(userId, userInfo);
        io.emit("getOnlineUsers", Array.from(onlineUsers.entries()));
      }
    });

    // Handle messages
    socket.on("sendMessage", async (message) => {
      const recipientInfo = onlineUsers.get(message.recipientId);

      if (recipientInfo) {
        io.to(recipientInfo.socketId).emit("getMessage", message);

        // Send delivery status
        message.deliveryStatus = "delivered";
        io.to(socket.id).emit("messageDeliveryStatus", {
          messageId: message._id,
          status: "delivered",
        });

        // Send typing indicator stop
        io.to(recipientInfo.socketId).emit("userStoppedTyping", {
          userId: message.senderId,
        });
      }

      // Send notification
      if (recipientInfo) {
        io.to(recipientInfo.socketId).emit("getNotification", {
          senderId: message.senderId,
          content: message.content,
          isRead: false,
          date: new Date(),
        });
      }
    });

    // Handle typing indicators
    socket.on("typing", ({ recipientId, senderId }) => {
      const recipientInfo = onlineUsers.get(recipientId);
      if (recipientInfo) {
        io.to(recipientInfo.socketId).emit("userTyping", { userId: senderId });
      }
    });

    socket.on("stopTyping", ({ recipientId, senderId }) => {
      const recipientInfo = onlineUsers.get(recipientId);
      if (recipientInfo) {
        io.to(recipientInfo.socketId).emit("userStoppedTyping", {
          userId: senderId,
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      // Find and update the disconnected user
      for (const [userId, userInfo] of onlineUsers.entries()) {
        if (userInfo.socketId === socket.id) {
          userInfo.lastSeen = new Date();
          userInfo.status = "offline";
          onlineUsers.set(userId, userInfo);
          break;
        }
      }

      io.emit("getOnlineUsers", Array.from(onlineUsers.entries()));
    });
  });

  return io;
};

module.exports = setupSocket;
