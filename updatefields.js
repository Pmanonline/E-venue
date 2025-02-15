const mongoose = require("mongoose");
const connectDB = require("./config/db.config"); // Adjust the path to your db config file

// Define a generic schema to interact with the collection
const Event = mongoose.model(
  "Event",
  new mongoose.Schema({}, { strict: false })
);

const updateFieldsInEvents = async () => {
  try {
    // Connect to the database
    await connectDB();

    console.log("Updating fields in events collection...");

    // Update all events by adding the new fields
    const result = await Event.updateMany(
      {}, // Matches all documents
      {
        $set: {
          lga: "Default LGA Value", // Replace with your desired default value
          area: "Default Area Value", // Replace with your desired default value
        },
      }
    );

    console.log(`${result.modifiedCount} documents updated successfully.`);
  } catch (error) {
    console.error("Error updating fields:", error);
  } finally {
    // Disconnect from the database
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
};

// Run the update function
updateFieldsInEvents();
