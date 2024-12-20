// models/venueModel.js
const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  capacity: { type: String, required: true },
  furnishing: { type: String },
  type: { type: String },
  bathrooms: { type: Number },
  toilets: { type: Number },
  duration: { type: String },

  pricingDetails: {
    totalpayment: { type: Number },
    initialPayment: { type: Number },
    percentage: { type: String },
    duration: { type: String },
  },

  address: {
    state: { type: String, required: true },
    lga: { type: String, required: true },
    area: { type: String },
    street: { type: String },
  },
  coverImage: { type: String },
  additionalImages: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Venue", venueSchema);
