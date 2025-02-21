const mongoose = require("mongoose");
const connectDB = require("./config/db.config"); // Adjust the path to your db config file

// Define a generic schema to interact with the collection
const Businesz = mongoose.model(
  "Businesz",
  new mongoose.Schema({}, { strict: false })
);

const updateFieldsInVenue = async () => {
  try {
    // Connect to the database
    await connectDB();

    console.log("Updating fields in Businesz collection...");

    // Update all Businesz by adding the new fields
    const result = await Businesz.updateMany(
      {}, // Matches all documents
      {
        $set: {
          slug: "", // Replace with your desired default value
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
updateFieldsInVenue();
