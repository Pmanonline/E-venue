const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema({
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
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  attendeeDetails: {
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
  },
  status: {
    type: String,
    enum: ["registered", "cancelled"],
    default: "registered",
  },
});

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
