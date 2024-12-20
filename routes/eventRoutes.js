const express = require("express");
const router = express.Router();
const {
  createEvent,
  checkTicketAvailability,
  reserveTicket,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require("../controllers/eventsController");

// Configure express-fileupload middleware

// Event routes
router.post("/createEvent", createEvent);
router.get("/tickets/:eventId", checkTicketAvailability);
router.post("/reserve/:eventId", reserveTicket);
router.get("/getAllEvents", getAllEvents);
router.get("/getEventById/:id", getEventById);
router.put("/updateEvent/:id", updateEvent);
router.delete("/deleteEvent/:id", deleteEvent);

module.exports = router;
