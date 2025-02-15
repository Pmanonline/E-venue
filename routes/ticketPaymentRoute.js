const express = require("express");
const router = express.Router();
const authmiddleware = require("../config/authMiddleware");
const {
  initializeTicketPayment,
  verifyTicketPayment,
  getTicketByReference,
  registerFreeTicket,
  getTicketById,
  getUserTickets,
} = require("../controllers/ticketPaymentController");

// Initialize ticket payment
router.post(
  "/tickets/payment/initialize",
  authmiddleware,
  initializeTicketPayment
);
router.get("/tickets/payment/verify", verifyTicketPayment);
router.get("/tickets/reference/:reference", getTicketByReference);
router.get("/tickets/getTicketById/:ticketId", getTicketById);
router.post("/tickets/register-free", authmiddleware, registerFreeTicket);
// router.get("/events/registrations", authmiddleware, getEventRegistrations);
router.get("/events/tickets", authmiddleware, getUserTickets);

module.exports = router;
