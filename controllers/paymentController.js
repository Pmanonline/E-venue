const axios = require("axios");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");
const PaymentNotification = require("../models/paymentNotificationModdel");

const initializePayment = async (req, res) => {
  try {
    const { email, amount, metadata } = req.body;

    // Log the request data for debugging
    console.log("Payment initialization request:", {
      email,
      amount,
      metadata,
    });

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount,
        metadata,
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log Paystack response for debugging
    console.log("Paystack response:", paystackResponse.data);

    // Verify the response structure
    if (!paystackResponse.data.data?.authorization_url) {
      throw new Error("Invalid response from Paystack");
    }

    // Create pending booking
    const booking = await Booking.create({
      userId: metadata.userId,
      venueId: metadata.venueId,
      eventDate: metadata.eventDate,
      amount,
      paymentStatus: "pending",
      paymentReference: paystackResponse.data.data.reference,
    });

    // Create initial notification
    await PaymentNotification.create({
      userId: metadata.userId,
      title: "Payment Initiated",
      message: `Your payment of ₦${
        amount / 100
      } for venue booking has been initiated`,
      type: "info",
    });

    // Send a properly structured response
    res.json({
      status: true,
      message: "Payment initialized",
      authorization_url: paystackResponse.data.data.authorization_url,
      reference: paystackResponse.data.data.reference,
    });
  } catch (error) {
    console.error(
      "Payment initialization error:",
      error.response?.data || error.message
    );

    // Create notification for failure
    if (req.body.metadata?.userId) {
      await PaymentNotification.create({
        userId: req.body.metadata.userId,
        title: "Payment Initialization Failed",
        message: "Unable to initialize your payment. Please try again.",
        type: "error",
      });
    }

    res.status(500).json({
      status: false,
      message: "Failed to initialize payment",
      error: error.response?.data?.message || error.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const { status, metadata, amount } = response.data.data;
    const success = status === "success";

    // Update booking status
    const booking = await Booking.findOneAndUpdate(
      { paymentReference: reference },
      { paymentStatus: success ? "completed" : "failed" },
      { new: true }
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Create detailed notification with booking information
    await PaymentNotification.create({
      userId: booking.userId,
      title: success ? "Payment Successful" : "Payment Failed",
      message: success
        ? `Your payment of ₦${
            amount / 100
          } for venue booking was successful. Booking reference: ${reference}`
        : `Your venue booking payment of ₦${
            amount / 100
          } was not successful. Please try again or contact support.`,
      type: success ? "success" : "error",
    });

    // Redirect user based on payment status
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/${
        success ? "success" : "failed"
      }?reference=${reference}`
    );
  } catch (error) {
    console.error("Payment verification error:", error);

    // Create notification for verification error
    const booking = await Booking.findOne({
      paymentReference: req.query.reference,
    });
    if (booking) {
      await PaymentNotification.create({
        userId: booking.userId,
        title: "Payment Verification Failed",
        message:
          "We couldn't verify your payment. If you believe this is an error, please contact support.",
        type: "error",
      });
    }

    res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
  }
};

// Add a utility function to handle notification creation
const createPaymentNotification = async (userId, title, message, type) => {
  try {
    return await PaymentNotification.create({
      userId,
      title,
      message,
      type,
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};
// In your backend booking controller
const getBookingByReference = async (req, res) => {
  try {
    const { reference } = req.params;

    const booking = await Booking.findOne({ paymentReference: reference });

    if (!booking) {
      return res.status(404).json({
        status: false,
        message: "Booking not found",
      });
    }

    res.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching booking details",
    });
  }
};
module.exports = {
  initializePayment,
  verifyPayment,
  createPaymentNotification,
  getBookingByReference,
};
