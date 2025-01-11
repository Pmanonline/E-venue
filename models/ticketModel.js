const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      // Generate a unique ticket ID with prefix TKT and random numbers
      default: () =>
        `TKT${Math.floor(Math.random() * 1000000)
          .toString()
          .padStart(6, "0")}`,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentReference: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["valid", "used", "cancelled"],
      default: "valid",
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    price: {
      type: Number,
      required: true,
    },
    qrCode: {
      type: String,
      // Will be generated after ticket creation
    },
    usedDate: {
      type: Date,
    },
    seatNumber: {
      type: String,
      // Optional, for events with assigned seating
    },
    ticketType: {
      type: String,
      enum: ["regular", "vip", "student"],
      default: "regular",
    },
    isTransferred: {
      type: Boolean,
      default: false,
    },
    transferredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    transferDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
ticketSchema.index({ ticketId: 1, paymentReference: 1 });
ticketSchema.index({ eventId: 1, status: 1 });
ticketSchema.index({ userId: 1 });
ticketSchema.index({ ownerId: 1 });

// Method to mark ticket as used
ticketSchema.methods.markAsUsed = function () {
  this.status = "used";
  this.usedDate = new Date();
  return this.save();
};

// Method to transfer ticket to another user
ticketSchema.methods.transferToUser = async function (newUserId) {
  this.isTransferred = true;
  this.transferredTo = newUserId;
  this.transferDate = new Date();
  return this.save();
};

// Method to validate ticket
ticketSchema.methods.isValid = function () {
  return this.status === "valid" && !this.usedDate;
};

// Static method to get tickets by event
ticketSchema.statics.getTicketsByEvent = function (eventId) {
  return this.find({ eventId, status: "valid" })
    .populate("userId", "name email")
    .sort("purchaseDate");
};

// Static method to get user's tickets
ticketSchema.statics.getUserTickets = function (userId) {
  return this.find({
    userId,
    status: { $in: ["valid", "used"] },
  })
    .populate("eventId")
    .sort("-purchaseDate");
};

const Ticket = mongoose.model("Ticket", ticketSchema);

module.exports = Ticket;
