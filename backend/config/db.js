const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI in the environment.
 * The app is written to still boot (auth routes will fail gracefully)
 * even if the DB is unreachable, so the WebRTC/signaling/whiteboard
 * demo can be explored without a database during development.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn("[db] MONGO_URI not set — skipping database connection.");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("[db] MongoDB connected");
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    console.warn(
      "[db] Continuing without a database. Auth endpoints will not work until MongoDB is available."
    );
  }
}

module.exports = connectDB;
