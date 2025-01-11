const socketIo = require("socket.io");
const SocketDebugger = require("../config/socketDebug");

const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Join user to their room
    socket.on("user_connected", (userId) => {
      socket.join(userId.toString()); // Ensure userId is string
      socket.broadcast.emit("user_online", userId);
    });

    // Handle private messages with proper room emission
    socket.on("private_message", async (data) => {
      try {
        const messageData = {
          ...data,
          timestamp: new Date(),
          _id: data._id || `temp-${Date.now()}`, // Ensure message has an ID
          deliveryStatus: "sent",
        };

        // Emit to sender's room
        io.to(data.senderId.toString()).emit("new_message", messageData);

        // Emit to receiver's room
        io.to(data.receiverId.toString()).emit("new_message", messageData);

        // Acknowledge message receipt
        socket.emit("message_sent", {
          messageId: messageData._id,
          status: "sent",
        });
      } catch (error) {
        console.error("Error handling private message:", error);
        socket.emit("message_error", {
          messageId: data._id,
          error: "Failed to process message",
        });
      }
    });

    // Handle typing status with proper room targeting
    socket.on("typing_start", (receiverId) => {
      socket.to(receiverId.toString()).emit("typing_started", socket.userId);
    });

    socket.on("typing_stop", (receiverId) => {
      socket.to(receiverId.toString()).emit("typing_stopped", socket.userId);
    });
  });

  return io;
};

module.exports = initializeSocket;
