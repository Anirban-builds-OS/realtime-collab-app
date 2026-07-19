const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { getDemoUserById } = require("../utils/demoUsers");

/**
 * Protects Express routes. Expects "Authorization: Bearer <token>".
 * Attaches the authenticated user (without password) to req.user.
 */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const dbReady = mongoose.connection.readyState === 1;

    let user = null;
    if (dbReady) {
      user = await User.findById(decoded.id);
    } else {
      user = getDemoUserById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
}

module.exports = { protect };
