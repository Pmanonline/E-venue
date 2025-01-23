const mongoose = require("mongoose");

const ServiceInterestSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Businesz",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User ",
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  preferredDate: {
    type: Date,
    required: true,
  },
  additionalNotes: {
    type: String,
    default: "",
  },
}, { timestamps: true });

module.exports = mongoose.model("ServiceInterest", ServiceInterestSchema);