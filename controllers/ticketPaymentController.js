const axios = require("axios");
const Event = require("../models/eventsModel");
const PaymentNotification = require("../models/paymentNotificationModdel");
const Ticket = require("../models/ticketModel");
const EventRegistration = require("../models/eventRegistrationModel");
const User = require("../models/userModel");
const Booking = require("../models/bookingModel");
const logger = require("../config/logger");
const mongoose = require("mongoose");
const {
  generateQRCode,
  sendTicketEmails,
} = require("../config/ticketMailService");
const initializeTicketPayment = async (req, res) => {
  try {
    console.log("Request body:", req.body);

    const eventId = req.body.eventId || req.body.metadata?.eventId;
    const quantity = req.body.quantity || req.body.metadata?.quantity;
    const email = req.body.email;
    const userId = req.user._id;

    if (!eventId || !quantity || !email) {
      throw new Error("Missing required fields: eventId, quantity, or email");
    }

    console.log("Looking for event with ID:", eventId);

    const event = await Event.findById(eventId);
    if (!event) {
      console.log("Event not found for ID:", eventId);
      throw new Error("Event not found");
    }

    const availability = event.checkAvailability();
    if (availability.availableTickets < quantity) {
      throw new Error("Not enough tickets available");
    }

    const amount = req.body.amount || event.price * quantity * 100;

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount,
        metadata: {
          userId,
          eventId,
          quantity,
          type: "ticket",
        },
        callback_url: `${process.env.FRONTEND_URL}/tickets/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Updated notification creation with recipients
    await PaymentNotification.create({
      userId,
      title: "Ticket Payment Initiated",
      message: `Payment initiated for ${quantity} ticket(s) to ${event.title}`,
      type: "info",
      recipients: [userId.toString()], // Convert ObjectId to string
    });

    res.json({
      status: true,
      message: "Payment initialized",
      authorization_url: paystackResponse.data.data.authorization_url,
      reference: paystackResponse.data.data.reference,
    });
  } catch (error) {
    console.error("Ticket payment initialization error:", error);

    if (req.user?._id) {
      await PaymentNotification.create({
        userId: req.user._id,
        title: "Ticket Payment Initialization Failed",
        message: "Unable to initialize ticket payment. Please try again.",
        type: "error",
        recipients: [req.user._id.toString()],
      });
    }

    res.status(500).json({
      status: false,
      message: "Failed to initialize ticket payment",
      error: error.message,
    });
  }
};

const verifyTicketPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference } = req.query;
    logger.info("Verifying ticket payment for reference:", { reference });

    // Check for existing tickets
    const existingTickets = await Ticket.find({ paymentReference: reference });
    if (existingTickets.length > 0) {
      logger.info("Payment already processed, returning existing tickets", {
        reference,
      });
      return res.json({
        status: true,
        message: "Payment already processed",
        reference,
        tickets: existingTickets,
      });
    }

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const { data } = response.data;
    const metadata = data.metadata;

    if (response.data.status !== true || data.status !== "success") {
      logger.error("Payment verification failed", { reference, data });
      throw new Error("Payment verification failed");
    }

    if (!metadata || !metadata.eventId || !metadata.userId) {
      logger.error("Invalid transaction metadata", { metadata });
      throw new Error("Invalid transaction metadata");
    }

    // Get event details
    const event = await Event.findOneAndUpdate(
      {
        _id: metadata.eventId,
        availableTickets: { $gte: metadata.quantity },
      },
      { $inc: { availableTickets: -metadata.quantity } },
      { new: true, session }
    );

    if (!event) {
      logger.error("Event not found or not enough tickets available", {
        eventId: metadata.eventId,
      });
      throw new Error("Event not found or not enough tickets available");
    }

    // Get user details
    const user = await User.findById(metadata.userId);
    if (!user) {
      logger.error("User not found", { userId: metadata.userId });
      throw new Error("User not found");
    }

    // Create booking record
    const booking = await Booking.create(
      [
        {
          userId: metadata.userId,
          venueId: event.venueId,
          venueName: event.title,
          eventDate: event.Date,
          amount: data.amount / 100,
          paymentStatus: "completed",
          paymentReference: reference,
          fullName: user.username || `${user.firstName} ${user.lastName}`,
          email: user.email,
          phoneNumber: user.phoneNumber,
          bookingType: "event",
        },
      ],
      { session }
    );

    // Generate tickets with QR codes
    const ticketsToCreate = [];
    for (let i = 0; i < metadata.quantity; i++) {
      const ticketId = `TKT${Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0")}`;

      const ticketData = {
        ticketId,
        eventId: metadata.eventId,
        userId: metadata.userId,
        ownerId: event.ownerId,
        paymentReference: reference,
        price: event.price,
        status: "valid",
        purchaseDate: new Date(),
        bookingType: "event",
        bookingId: booking[0]._id,
      };

      // Create a temporary ticket object for QR code generation
      const tempTicket = {
        ...ticketData,
        save: async () => {}, // Mock save method since the actual ticket hasn't been created yet
      };

      try {
        const qrCodeDataUrl = await generateQRCode(tempTicket, event);
        if (qrCodeDataUrl) {
          ticketData.qrCode = qrCodeDataUrl;
        } else {
          logger.error(`Failed to generate QR code for ticket ${ticketId}`);
        }
      } catch (qrError) {
        logger.error(
          `Error generating QR code for ticket ${ticketId}:`,
          qrError
        );
        // Continue with ticket creation even if QR code generation fails
      }

      ticketsToCreate.push(ticketData);
    }

    const reservedTickets = await Ticket.insertMany(ticketsToCreate, {
      session,
    });

    // Send confirmation emails with enhanced error handling
    logger.info("Sending confirmation emails...");
    const emailResult = await sendTicketEmails(reservedTickets, event, user);
    logger.info("Email sending result:", emailResult);

    if (emailResult.failed.length > 0) {
      logger.error("Some ticket emails failed to send:", emailResult.failed);
      // Create notification for failed emails
      await PaymentNotification.create(
        [
          {
            userId: metadata.userId,
            title: "Ticket Email Delivery Issue",
            message:
              "Some ticket emails could not be delivered. Please contact support.",
            type: "warning",
            recipients: [metadata.userId.toString()],
          },
        ],
        { session }
      );
    }

    // Create success notifications
    await PaymentNotification.create(
      [
        {
          userId: metadata.userId,
          title: "Ticket Purchase Successful",
          message: `Successfully purchased ${metadata.quantity} ticket(s) for ${event.title}`,
          type: "success",
          recipients: [metadata.userId.toString(), event.ownerId.toString()],
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.json({
      status: true,
      message: "Payment verified and booking created successfully",
      reference,
      tickets: reservedTickets,
      booking: booking[0],
      emailStatus: {
        sent: emailResult.sent,
        failed: emailResult.failed,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Ticket payment verification error:", error);

    if (req.query.reference && metadata?.userId) {
      try {
        await PaymentNotification.create({
          userId: metadata.userId,
          title: "Ticket Purchase Failed",
          message: "Your ticket purchase was not successful. Please try again.",
          type: "error",
          recipients: [metadata.userId.toString()],
        });
      } catch (notificationError) {
        logger.error(
          "Failed to create failure notification:",
          notificationError
        );
      }
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Payment verification failed",
      error: error.response?.data || error.message,
      reference: req.query.reference,
    });
  } finally {
    session.endSession();
  }
};

const getTicketByReference = async (req, res) => {
  try {
    const { reference } = req.params;

    const tickets = await Ticket.find({
      paymentReference: reference,
    })
      .populate("eventId")
      .populate("userId", "name email");

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No tickets found for this reference",
      });
    }

    res.json({
      status: true,
      tickets,
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching ticket details",
      error: error.message,
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Find ticket with proper population
    const ticket = await Ticket.findOne({ ticketId: ticketId })
      .populate({
        path: "eventId",
        select: "title Date",
      })
      .populate({
        path: "userId",
        select: "username email", // Changed from fullName to match your schema
      })
      .populate({
        path: "ownerId",
        select: "username email",
      });

    // Handle case where ticket is not found
    if (!ticket) {
      return res.status(404).json({
        status: false,
        message: "Ticket not found",
      });
    }

    // Format response to exactly match your example
    const formattedTicket = {
      ticketId: ticket.ticketId,
      paymentReference: ticket.paymentReference,
      amount: ticket.price,
      paymentStatus: ticket.status,
      qrCode: ticket.qrCode,
      ticketType: ticket.ticketType,
      isTransferred: ticket.isTransferred,
      purchaseDate: ticket.purchaseDate,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      // Include populated fields if they exist
      ...(ticket.eventId && {
        venueName: ticket.eventId.title,
        eventDate: ticket.eventId.Date,
      }),
      ...(ticket.userId && {
        username: ticket.userId.username,
        email: ticket.userId.email,
      }),
      ...(ticket.ownerId && {
        ownerUsername: ticket.ownerId.username,
        ownerEmail: ticket.ownerId.email,
      }),
    };

    logger.info(`ticket.eventId.title: ${ticket.eventId.title}`);

    // Return successful response that matches your example format
    res.json(formattedTicket);
  } catch (error) {
    // Log error for debugging
    console.error("Error fetching ticket:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        status: false,
        message: "Invalid ticket ID format",
      });
    }

    res.status(500).json({
      status: false,
      message: "Error fetching ticket details",
      error: error.message,
    });
  }
};

const registerFreeTicket = async (req, res) => {
  try {
    const { eventId, firstName, lastName, email, confirmEmail, phoneNumber } =
      req.body;
    const userId = req.user._id;

    // Validate event
    const event = await Event.findById(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    if (event.price !== 0) {
      throw new Error("This is not a free event");
    }

    // Validate email match
    if (email !== confirmEmail) {
      throw new Error("Email addresses do not match");
    }

    // Check for existing registration
    const existingRegistration = await EventRegistration.findOne({
      eventId,
      "attendeeDetails.email": email,
    });

    if (existingRegistration) {
      throw new Error(
        "This email address is already registered for this event"
      );
    }

    // Create a new registration document
    const registration = await EventRegistration.create({
      eventId,
      userId,
      registrationDate: new Date(),
      attendeeDetails: {
        firstName,
        lastName,
        email,
        phoneNumber,
      },
      status: "registered",
    });

    // Generate ticket for free event
    const ticket = await Ticket.create({
      ticketId: `TKT${Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0")}`,
      eventId,
      userId,
      ownerId: event.ownerId,
      paymentReference: `FREE-${Date.now()}`,
      price: 0,
      status: "valid",
      purchaseDate: new Date(),
    });

    // Get user details for email
    const user = await User.findById(userId);

    // Send ticket email
    const emailResult = await sendTicketEmails([ticket], event, {
      email,
      username: `${firstName} ${lastName}`,
    });

    if (emailResult.failed.length > 0) {
      console.error("Failed to send ticket email:", emailResult.failed);
    }

    // Create success notification with recipients
    await PaymentNotification.create({
      userId,
      title: "Free Event Registration Successful",
      message: `Successfully registered for ${event.title}`,
      type: "success",
      recipients: [userId.toString(), event.ownerId.toString()], // Notify both user and event owner
    });

    res.json({
      status: true,
      message: "Registration successful",
      registration,
      ticket,
    });
  } catch (error) {
    console.error("Free event registration error:", error);

    // Create failure notification with recipients
    if (req.user?._id) {
      await PaymentNotification.create({
        userId: req.user._id,
        title: "Event Registration Failed",
        message:
          error.message || "Unable to complete registration. Please try again.",
        type: "error",
        recipients: [req.user._id.toString()], // Notify only the user of the failure
      });
    }

    res.status(400).json({
      status: false,
      message: error.message || "Failed to register for event",
      error: error.message,
    });
  }
};

const getUserTickets = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { search, eventName } = req.query;

    // Start with basic pipeline to get related data
    const pipeline = [
      // Initial match for owner
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
        },
      },
      // Lookup event details
      {
        $lookup: {
          from: "events",
          localField: "eventId",
          foreignField: "_id",
          as: "eventId",
        },
      },
      { $unwind: "$eventId" },
      // Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      },
      { $unwind: "$userId" },
    ];

    // Add search conditions after lookups if search term exists
    if (search) {
      const searchRegex = new RegExp(search, "i");
      pipeline.push({
        $match: {
          $or: [
            { ticketId: searchRegex },
            { "userId.email": searchRegex },
            { "userId.username": searchRegex },
          ],
        },
      });
    }

    // Add event name filter if provided
    if (eventName) {
      pipeline.push({
        $match: {
          "eventId.title": new RegExp(eventName, "i"),
        },
      });
    }

    // Add final projection and sort
    pipeline.push(
      {
        $project: {
          ticketId: 1,
          "eventId.title": 1,
          "eventId.eventType": 1,
          "eventId.Date": 1,
          "eventId.location": 1,
          "eventId.venue": 1,
          "eventId.category": 1,
          "eventId.price": 1,
          "userId.username": 1,
          "userId.email": 1,
          price: 1,
          purchaseDate: 1,
          paymentReference: 1,
          status: 1,
        },
      },
      {
        $sort: { purchaseDate: -1 },
      }
    );

    const tickets = await Ticket.aggregate(pipeline);

    res.json({
      status: true,
      tickets,
    });
  } catch (error) {
    console.error("Error fetching owner tickets:", error);
    res.status(500).json({
      status: false,
      message: "Error fetching tickets",
      error: error.message,
    });
  }
};
module.exports = {
  initializeTicketPayment,
  verifyTicketPayment,
  getTicketByReference,
  registerFreeTicket,
  getTicketById,
  getUserTickets,
};

// const axios = require("axios");
// const Event = require("../models/eventsModel");
// const PaymentNotification = require("../models/paymentNotificationModdel");
// const Ticket = require("../models/ticketModel");
// const EventRegistration = require("../models/eventRegistrationModel");
// const User = require("../models/userModel");
// const mongoose = require("mongoose");
// const {
//   sendTicketEmails,
//   generateQRCode,
// } = require("../config/ticketMailService");

// const initializeTicketPayment = async (req, res) => {
//   try {
//     console.log("Request body:", req.body);

//     const eventId = req.body.eventId || req.body.metadata?.eventId;
//     const quantity = req.body.quantity || req.body.metadata?.quantity;
//     const email = req.body.email;
//     const userId = req.user._id;

//     if (!eventId || !quantity || !email) {
//       throw new Error("Missing required fields: eventId, quantity, or email");
//     }

//     console.log("Looking for event with ID:", eventId);

//     const event = await Event.findById(eventId);
//     if (!event) {
//       console.log("Event not found for ID:", eventId);
//       throw new Error("Event not found");
//     }

//     const availability = event.checkAvailability();
//     if (availability.availableTickets < quantity) {
//       throw new Error("Not enough tickets available");
//     }

//     const amount = req.body.amount || event.price * quantity * 100;

//     const paystackResponse = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       {
//         email,
//         amount,
//         metadata: {
//           userId,
//           eventId,
//           quantity,
//           type: "ticket",
//         },
//         callback_url: `${process.env.FRONTEND_URL}/tickets/verify`,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // Updated notification creation with recipients
//     await PaymentNotification.create({
//       userId,
//       title: "Ticket Payment Initiated",
//       message: `Payment initiated for ${quantity} ticket(s) to ${event.title}`,
//       type: "info",
//       recipients: [userId.toString()], // Convert ObjectId to string
//     });

//     res.json({
//       status: true,
//       message: "Payment initialized",
//       authorization_url: paystackResponse.data.data.authorization_url,
//       reference: paystackResponse.data.data.reference,
//     });
//   } catch (error) {
//     console.error("Ticket payment initialization error:", error);

//     if (req.user?._id) {
//       await PaymentNotification.create({
//         userId: req.user._id,
//         title: "Ticket Payment Initialization Failed",
//         message: "Unable to initialize ticket payment. Please try again.",
//         type: "error",
//         recipients: [req.user._id.toString()],
//       });
//     }

//     res.status(500).json({
//       status: false,
//       message: "Failed to initialize ticket payment",
//       error: error.message,
//     });
//   }
// };

// const verifyTicketPayment = async (req, res) => {
//   const { reference } = req.query;
//   console.log("Received reference:", reference);

//   try {
//     const existingTickets = await Ticket.find({ paymentReference: reference });
//     if (existingTickets.length > 0) {
//       console.log("Payment already processed, returning existing tickets");
//       return res.json({
//         status: true,
//         message: "Payment already processed",
//         reference,
//         tickets: existingTickets,
//       });
//     }

//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         },
//       }
//     );

//     const { data } = response.data;

//     if (response.data.status !== true || data.status !== "success") {
//       throw new Error("Payment verification failed");
//     }

//     const metadata = data.metadata;
//     if (!metadata || !metadata.eventId) {
//       throw new Error("Invalid transaction metadata");
//     }

//     const event = await Event.findOneAndUpdate(
//       {
//         _id: metadata.eventId,
//         availableTickets: { $gte: metadata.quantity },
//       },
//       { $inc: { availableTickets: -metadata.quantity } },
//       { new: true }
//     );

//     if (!event) {
//       throw new Error("Not enough tickets available");
//     }

//     const ticketsToCreate = Array.from({ length: metadata.quantity }, () => ({
//       ticketId: `TKT${Math.floor(Math.random() * 1000000)
//         .toString()
//         .padStart(6, "0")}`,
//       eventId: metadata.eventId,
//       userId: metadata.userId,
//       ownerId: event.ownerId,
//       paymentReference: reference,
//       price: event.price,
//       status: "valid",
//       purchaseDate: new Date(),
//       //bookingType: "event",
//     }));

//     const reservedTickets = await Ticket.insertMany(ticketsToCreate);

//     // Generate QR codes for each ticket
//     for (const ticket of reservedTickets) {
//       const qrCodeDataUrl = await generateQRCode(ticket, event);
//       ticket.qrCode = qrCodeDataUrl;
//       await ticket.save();
//     }

//     const user = await User.findById(metadata.userId);
//     await sendTicketEmails(reservedTickets, event, user);

//     // Updated notification with recipients
//     await PaymentNotification.create({
//       userId: metadata.userId,
//       title: "Ticket Purchase Successful",
//       message: `Successfully purchased ${metadata.quantity} ticket(s) for ${event.title}`,
//       type: "success",
//       recipients: [metadata.userId.toString(), event.ownerId.toString()], // Notify both user and event owner
//     });

//     return res.json({
//       status: true,
//       message: "Payment verified successfully",
//       reference,
//       tickets: reservedTickets,
//     });
//   } catch (error) {
//     console.error("Ticket payment verification error:", error);

//     if (error.response?.data?.metadata?.userId) {
//       await PaymentNotification.create({
//         userId: error.response.data.metadata.userId,
//         title: "Ticket Purchase Failed",
//         message: "Your ticket purchase was not successful. Please try again.",
//         type: "error",
//         recipients: [error.response.data.metadata.userId.toString()],
//       });
//     }

//     return res.status(500).json({
//       status: false,
//       message: error.message || "Payment verification failed",
//       error: error.response?.data || error.message,
//       reference: req.query.reference,
//     });
//   }
// };

// const getTicketByReference = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     const tickets = await Ticket.find({
//       paymentReference: reference,
//     })
//       .populate("eventId")
//       .populate("userId", "name email");

//     if (!tickets || tickets.length === 0) {
//       return res.status(404).json({
//         status: false,
//         message: "No tickets found for this reference",
//       });
//     }

//     res.json({
//       status: true,
//       tickets,
//     });
//   } catch (error) {
//     console.error("Error fetching tickets:", error);
//     res.status(500).json({
//       status: false,
//       message: "Error fetching ticket details",
//       error: error.message,
//     });
//   }
// };

// const registerFreeTicket = async (req, res) => {
//   try {
//     const { eventId, firstName, lastName, email, confirmEmail, phoneNumber } =
//       req.body;
//     const userId = req.user._id;

//     // Validate event
//     const event = await Event.findById(eventId);
//     if (!event) {
//       throw new Error("Event not found");
//     }

//     if (event.price !== 0) {
//       throw new Error("This is not a free event");
//     }

//     // Validate email match
//     if (email !== confirmEmail) {
//       throw new Error("Email addresses do not match");
//     }

//     // Check for existing registration
//     const existingRegistration = await EventRegistration.findOne({
//       eventId,
//       "attendeeDetails.email": email,
//     });

//     if (existingRegistration) {
//       throw new Error(
//         "This email address is already registered for this event"
//       );
//     }

//     // Create a new registration document
//     const registration = await EventRegistration.create({
//       eventId,
//       userId,
//       registrationDate: new Date(),
//       attendeeDetails: {
//         firstName,
//         lastName,
//         email,
//         phoneNumber,
//       },
//       status: "registered",
//     });

//     // Generate ticket for free event
//     const ticket = await Ticket.create({
//       ticketId: `TKT${Math.floor(Math.random() * 1000000)
//         .toString()
//         .padStart(6, "0")}`,
//       eventId,
//       userId,
//       ownerId: event.ownerId,
//       paymentReference: `FREE-${Date.now()}`,
//       price: 0,
//       status: "valid",
//       purchaseDate: new Date(),
//     });

//     // Generate QR code for the ticket
//     const qrCodeDataUrl = await generateQRCode(ticket, event);
//     ticket.qrCode = qrCodeDataUrl;
//     await ticket.save();

//     // Get user details for email
//     const user = await User.findById(userId);

//     // Send ticket email
//     const emailResult = await sendTicketEmails([ticket], event, {
//       email,
//       username: `${firstName} ${lastName}`,
//     });

//     if (emailResult.failed.length > 0) {
//       console.error("Failed to send ticket email:", emailResult.failed);
//     }

//     // Create success notification with recipients
//     await PaymentNotification.create({
//       userId,
//       title: "Free Event Registration Successful",
//       message: `Successfully registered for ${event.title}`,
//       type: "success",
//       recipients: [userId.toString(), event.ownerId.toString()], // Notify both user and event owner
//     });

//     res.json({
//       status: true,
//       message: "Registration successful",
//       registration,
//       ticket,
//     });
//   } catch (error) {
//     console.error("Free event registration error:", error);

//     // Create failure notification with recipients
//     if (req.user?._id) {
//       await PaymentNotification.create({
//         userId: req.user._id,
//         title: "Event Registration Failed",
//         message:
//           error.message || "Unable to complete registration. Please try again.",
//         type: "error",
//         recipients: [req.user._id.toString()], // Notify only the user of the failure
//       });
//     }

//     res.status(400).json({
//       status: false,
//       message: error.message || "Failed to register for event",
//       error: error.message,
//     });
//   }
// };

// const getUserTickets = async (req, res) => {
//   try {
//     const ownerId = req.user._id;
//     const { search, eventName } = req.query;

//     // Start with basic pipeline to get related data
//     const pipeline = [
//       // Initial match for owner
//       {
//         $match: {
//           ownerId: new mongoose.Types.ObjectId(ownerId),
//         },
//       },
//       // Lookup event details
//       {
//         $lookup: {
//           from: "events",
//           localField: "eventId",
//           foreignField: "_id",
//           as: "eventId",
//         },
//       },
//       { $unwind: "$eventId" },
//       // Lookup user details
//       {
//         $lookup: {
//           from: "users",
//           localField: "userId",
//           foreignField: "_id",
//           as: "userId",
//         },
//       },
//       { $unwind: "$userId" },
//     ];

//     // Add search conditions after lookups if search term exists
//     if (search) {
//       const searchRegex = new RegExp(search, "i");
//       pipeline.push({
//         $match: {
//           $or: [
//             { ticketId: searchRegex },
//             { "userId.email": searchRegex },
//             { "userId.username": searchRegex },
//           ],
//         },
//       });
//     }

//     // Add event name filter if provided
//     if (eventName) {
//       pipeline.push({
//         $match: {
//           "eventId.title": new RegExp(eventName, "i"),
//         },
//       });
//     }

//     // Add final projection and sort
//     pipeline.push(
//       {
//         $project: {
//           ticketId: 1,
//           "eventId.title": 1,
//           "eventId.eventType": 1,
//           "eventId.Date": 1,
//           "eventId.location": 1,
//           "eventId.venue": 1,
//           "eventId.category": 1,
//           "eventId.price": 1,
//           "userId.username": 1,
//           "userId.email": 1,
//           price: 1,
//           purchaseDate: 1,
//           paymentReference: 1,
//           status: 1,
//         },
//       },
//       {
//         $sort: { purchaseDate: -1 },
//       }
//     );

//     const tickets = await Ticket.aggregate(pipeline);

//     res.json({
//       status: true,
//       tickets,
//     });
//   } catch (error) {
//     console.error("Error fetching owner tickets:", error);
//     res.status(500).json({
//       status: false,
//       message: "Error fetching tickets",
//       error: error.message,
//     });
//   }
// };

// module.exports = {
//   initializeTicketPayment,
//   verifyTicketPayment,
//   getTicketByReference,
//   registerFreeTicket,
//   getUserTickets,
// };
