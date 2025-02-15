const axios = require("axios");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");
const PaymentNotification = require("../models/paymentNotificationModdel");
const logger = require("../config/logger");

logger.info("This is an info message");
logger.error("This is an error message");

// Add a Set to track processed payments
const processedPayments = new Set();

const sendBookingConfirmationEmail = async (
  booking,
  qrCodeDataUrl,
  userEmail
) => {
  console.log("Starting email sending process...");
  console.log("Recipient email:", userEmail);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const emailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Booking Confirmation</h2>
      <p>Thank you for your booking! Here are your details:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Booking Reference:</strong> ${booking.paymentReference}</p>
        <p><strong>Amount Paid:</strong> ₦${booking.amount / 100}</p>
        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${booking.paymentStatus}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <p><strong>Your Booking QR Code:</strong></p>
        <img src="${qrCodeDataUrl}" alt="Booking QR Code" style="max-width: 200px;"/>
        <p style="font-size: 0.9em; color: #666;">
          Keep this QR code handy for quick access to your booking details.
        </p>
      </div>

      <p style="color: #666; font-size: 0.9em;">
        If you have any questions about your booking, please contact our support team.
      </p>
    </div>
  `;

  const mailOptions = {
    from: "petersonzoconis@gmail.com",
    to: userEmail,
    subject: "Venue Booking Confirmation",
    html: emailTemplate,
    attachments: [
      {
        filename: "booking-qr.png",
        content: qrCodeDataUrl.split(";base64,").pop(),
        encoding: "base64",
      },
    ],
  };

  try {
    console.log("Attempting to send email...");
    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};

const generateQRCode = async (bookingData) => {
  try {
    // Create a URL that points to the booking details page
    const bookingUrl = `${process.env.FRONTEND_URL}/booking/${bookingData.paymentReference}`;

    // Generate QR code with the URL
    return await QRCode.toDataURL(bookingUrl, {
      errorCorrectionLevel: "H", // Highest error correction
      margin: 2,
      width: 400,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw error;
  }
};

// const verifyPayment = async (req, res) => {
//   const { reference } = req.query;

//   // Validate payment reference
//   if (!reference || typeof reference !== "string") {
//     logger.warn("Invalid payment reference provided", { reference });
//     return res.status(400).json({
//       status: false,
//       message: "Invalid payment reference",
//     });
//   }

//   // Check if payment has already been processed
//   if (processedPayments.has(reference)) {
//     logger.info(
//       `Payment ${reference} already processed, skipping verification`
//     );
//     return res.redirect(
//       `${process.env.FRONTEND_URL}/payment/success?reference=${reference}`
//     );
//   }

//   try {
//     // Verify payment with Paystack API
//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         },
//       }
//     );

//     const { status, amount, metadata } = response.data.data;
//     const success = status === "success";

//     // Mark payment as processed to avoid duplicates
//     processedPayments.add(reference);
//     setTimeout(() => processedPayments.delete(reference), 1800000); // 30 minutes

//     // Update booking status in the database
//     const booking = await Booking.findOneAndUpdate(
//       { paymentReference: reference },
//       { paymentStatus: success ? "completed" : "failed" },
//       { new: true }
//     )
//       .populate({
//         path: "venueId",
//         select: "title ownerId", // Only fetch necessary fields
//       })
//       .lean();

//     if (!booking) {
//       logger.error("Booking not found for reference", { reference });
//       throw new Error("Booking not found");
//     }

//     // Ensure venueName is set
//     if (booking.venueId && booking.venueId.title && !booking.venueName) {
//       await Booking.findByIdAndUpdate(booking._id, {
//         venueName: booking.venueId.title,
//       });
//       booking.venueName = booking.venueId.title;
//     }

//     // Handle successful payment
//     if (success) {
//       try {
//         // Generate QR code for the booking
//         const qrCodeDataUrl = await generateQRCode(booking);

//         // Update booking with QR code
//         await Booking.findByIdAndUpdate(booking._id, {
//           qrCode: qrCodeDataUrl,
//         });

//         // Send confirmation email to the user
//         if (booking.email) {
//           await sendBookingConfirmationEmail(
//             booking,
//             qrCodeDataUrl,
//             booking.email
//           );
//           logger.info("Confirmation email sent successfully", {
//             email: booking.email,
//           });
//         } else {
//           logger.warn("No email address found for booking", { reference });
//         }
//       } catch (qrError) {
//         logger.error("Error generating QR code or sending email", {
//           error: qrError.message,
//           reference,
//         });
//       }
//     }

//     // Create payment notification for the user and venue owner
//     await PaymentNotification.create({
//       userId: booking.userId,
//       title: success ? "Payment Successful" : "Payment Failed",
//       message: success
//         ? `Your payment of ₦${amount / 100} for ${booking.venueName || "venue booking"} was successful. Booking reference: ${reference}`
//         : `Your venue booking payment of ₦${amount / 100} was not successful. Please try again or contact support.`,
//       type: success ? "success" : "error",
//       recipients: [
//         booking.userId.toString(),
//         booking.venueId.ownerId.toString(),
//       ],
//     });

//     logger.info("Payment verification completed", {
//       reference,
//       status: success ? "success" : "failed",
//     });

//     // Redirect user to the appropriate frontend page
//     res.redirect(
//       `${process.env.FRONTEND_URL}/payment/${success ? "success" : "failed"}?reference=${reference}`
//     );
//   } catch (error) {
//     logger.error("Payment verification error", {
//       error: error.message,
//       reference,
//     });

//     // Create a notification for payment verification failure
//     const booking = await Booking.findOne({
//       paymentReference: reference,
//     });

//     if (booking && !processedPayments.has(reference)) {
//       await PaymentNotification.create({
//         userId: booking.userId,
//         title: "Payment Verification Failed",
//         message:
//           "We couldn't verify your payment. If you believe this is an error, please contact support.",
//         type: "error",
//         recipients: [booking.userId.toString()],
//       });
//     }

//     // Redirect user to the failure page
//     res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
//   }
// };
const verifyPayment = async (req, res) => {
  const { reference } = req.query;

  // Debugging: Log the FRONTEND_URL
  console.log("Frontend URL:", process.env.FRONTEND_URL);

  if (!process.env.FRONTEND_URL) {
    logger.error("FRONTEND_URL environment variable is not set.");
    return res.status(500).json({
      status: false,
      message: "Server configuration error. Please contact support.",
    });
  }

  // Validate payment reference
  if (!reference || typeof reference !== "string") {
    logger.warn("Invalid payment reference provided", { reference });
    return res.status(400).json({
      status: false,
      message: "Invalid payment reference",
    });
  }

  // Check if payment has already been processed
  if (processedPayments.has(reference)) {
    logger.info(
      `Payment ${reference} already processed, skipping verification`
    );
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment/success?reference=${reference}`
    );
  }

  try {
    // Verify payment with Paystack API
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const { status, amount, metadata } = response.data.data;
    const success = status === "success";

    // Mark payment as processed to avoid duplicates
    processedPayments.add(reference);
    setTimeout(() => processedPayments.delete(reference), 1800000); // 30 minutes

    // Update booking status in the database
    const booking = await Booking.findOneAndUpdate(
      { paymentReference: reference },
      { paymentStatus: success ? "completed" : "failed" },
      { new: true }
    )
      .populate({
        path: "venueId",
        select: "title ownerId", // Only fetch necessary fields
      })
      .lean();

    if (!booking) {
      logger.error("Booking not found for reference", { reference });
      throw new Error("Booking not found");
    }

    // Ensure venueName is set
    if (booking.venueId && booking.venueId.title && !booking.venueName) {
      await Booking.findByIdAndUpdate(booking._id, {
        venueName: booking.venueId.title,
      });
      booking.venueName = booking.venueId.title;
    }

    // Handle successful payment
    if (success) {
      try {
        // Generate QR code for the booking
        const qrCodeDataUrl = await generateQRCode(booking);

        // Update booking with QR code
        await Booking.findByIdAndUpdate(booking._id, {
          qrCode: qrCodeDataUrl,
        });

        // Send confirmation email to the user
        if (booking.email) {
          await sendBookingConfirmationEmail(
            booking,
            qrCodeDataUrl,
            booking.email
          );
          logger.info("Confirmation email sent successfully", {
            email: booking.email,
          });
        } else {
          logger.warn("No email address found for booking", { reference });
        }
      } catch (qrError) {
        logger.error("Error generating QR code or sending email", {
          error: qrError.message,
          reference,
        });
      }
    }

    // Create payment notification for the user and venue owner
    await PaymentNotification.create({
      userId: booking.userId,
      title: success ? "Payment Successful" : "Payment Failed",
      message: success
        ? `Your payment of ₦${amount / 100} for ${booking.venueName || "venue booking"} was successful. Booking reference: ${reference}`
        : `Your venue booking payment of ₦${amount / 100} was not successful. Please try again or contact support.`,
      type: success ? "success" : "error",
      recipients: [
        booking.userId.toString(),
        booking.venueId.ownerId.toString(),
      ],
    });

    logger.info("Payment verification completed", {
      reference,
      status: success ? "success" : "failed",
    });

    // Redirect user to the appropriate frontend page
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/${success ? "success" : "failed"}?reference=${reference}`
    );
  } catch (error) {
    logger.error("Payment verification error", {
      error: error.message,
      reference,
    });

    // Create a notification for payment verification failure
    const booking = await Booking.findOne({
      paymentReference: reference,
    });

    if (booking && !processedPayments.has(reference)) {
      await PaymentNotification.create({
        userId: booking.userId,
        title: "Payment Verification Failed",
        message:
          "We couldn't verify your payment. If you believe this is an error, please contact support.",
        type: "error",
        recipients: [booking.userId.toString()],
      });
    }

    // Redirect user to the failure page
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
  }
};
const initializePayment = async (req, res) => {
  try {
    const { email, amount, metadata } = req.body;

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

    if (!paystackResponse.data.data?.authorization_url) {
      throw new Error("Invalid response from Paystack");
    }

    // Create pending booking with additional fields
    const booking = await Booking.create({
      userId: metadata.userId,
      venueId: metadata.venueId,
      venueName: metadata.venueName,
      eventDate: metadata.eventDate,
      amount,
      paymentStatus: "pending",
      paymentReference: paystackResponse.data.data.reference,
      fullName: metadata.fullName,
      email: metadata.email,
      phoneNumber: metadata.phoneNumber,
      bookingType: "venue",
    });

    // Create payment notification
    await PaymentNotification.create({
      userId: metadata.userId,
      title: "Payment Initiated",
      message: `Your payment of ₦${amount / 100} for ${metadata.venueName} has been initiated`,
      type: "info",
      recipients: [metadata.userId.toString()],
    });

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

    if (req.body.metadata?.userId) {
      await PaymentNotification.create({
        userId: req.body.metadata.userId,
        title: "Payment Initialization Failed",
        message: "Unable to initialize your payment. Please try again.",
        type: "error",
        recipients: [req.body.metadata.userId.toString()],
      });
    }

    res.status(500).json({
      status: false,
      message: "Failed to initialize payment",
      error: error.response?.data?.message || error.message,
    });
  }
};

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

// Updated utility function with recipients parameter
const createPaymentNotification = async (
  userId,
  title,
  message,
  type,
  recipients
) => {
  try {
    return await PaymentNotification.create({
      userId,
      title,
      message,
      type,
      recipients: recipients || [userId.toString()], // Default to just the user if no recipients specified
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

const getVenueBookingByRef = async (req, res) => {
  const { reference } = req.params;

  try {
    // Fetch booking details from the database
    const booking = await Booking.findOne({ paymentReference: reference });

    if (!booking) {
      return res
        .status(404)
        .json({ status: false, message: "Booking not found" });
    }

    // Return booking details as JSON
    res.json({
      status: true,
      data: {
        paymentReference: booking.paymentReference,
        venueName: booking.venueName || "N/A",
        fullName: booking.fullName || "N/A",
        eventDate: new Date(booking.eventDate).toLocaleDateString(),
        amount: booking.amount / 100,
        paymentStatus: booking.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching booking details:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalBookings = await Booking.countDocuments();
    const totalPages = Math.ceil(totalBookings / limit);

    // Fetch bookings with pagination and populate user details
    const bookings = await Booking.find()
      .populate("userId", "username email")
      .populate("venueId", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format the bookings data
    const formattedBookings = bookings.map((booking) => ({
      ...booking,
      amount: booking.amount / 100, // Convert amount to readable format
      eventDate: new Date(booking.eventDate).toLocaleDateString(),
      createdAt: new Date(booking.createdAt).toLocaleDateString(),
    }));

    res.json({
      status: true,
      data: {
        bookings: formattedBookings,
        currentPage: page,
        totalPages,
        totalBookings,
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching booking details",
      error: error.message,
    });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  createPaymentNotification,
  getBookingByReference,
  getAllBookings,
  getVenueBookingByRef,
};
