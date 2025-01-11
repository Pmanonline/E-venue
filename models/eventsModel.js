const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
  },
  isTaken: {
    type: Boolean,
    default: false,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  purchaseDate: {
    type: Date,
    default: null,
  },
});

const eventSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ["conference", "workshop", "seminar", "webinar", "other"],
    },
    Date: {
      type: Date,
    },
    timeZone: {
      type: String,
    },
    location: {
      type: String,
    },
    state: {
      type: String,
    },
    description: {
      type: String,
    },
    isPaidEvent: {
      type: Boolean,
      required: true,
      default: false,
    },
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    capacity: {
      type: Number,
      min: 0,
    },
    ticketName: {
      type: String,
    },
    ticketStock: {
      type: Number, // Changed from String to Number
      min: 0,
    },
    ticketDescription: {
      type: String,
    },
    ticketPurchaseLimit: {
      type: Number,
      min: 0,
    },
    tickets: [ticketSchema],
    availableTickets: {
      type: Number,
      default: 0,
    },
    organizer: {
      type: String,
    },
    website: {
      type: String,
    },
    tags: [
      {
        type: String,
      },
    ],
    coverImage: {
      type: String,
    },
    additionalImages: [
      {
        type: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to generate unique ticket ID
eventSchema.statics.generateTicketId = function (eventId, index) {
  return `${eventId}-${index + 1}`.toUpperCase();
};

// Instance method to check ticket availability
eventSchema.methods.checkAvailability = function () {
  return {
    totalTickets: this.tickets.length,
    availableTickets: this.tickets.filter((ticket) => !ticket.isTaken).length,
    isSoldOut: this.tickets.every((ticket) => ticket.isTaken),
  };
};

// Instance method to reserve a ticket
eventSchema.methods.reserveTicket = async function (userId) {
  const availableTicket = this.tickets.find((ticket) => !ticket.isTaken);

  if (!availableTicket) {
    throw new Error("No tickets available");
  }

  availableTicket.isTaken = true;
  availableTicket.userId = userId;
  availableTicket.purchaseDate = new Date();
  this.availableTickets -= 1;

  await this.save();
  return availableTicket;
};

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;
