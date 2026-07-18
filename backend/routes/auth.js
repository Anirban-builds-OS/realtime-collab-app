const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, me } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Slow down brute-force attempts against login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", protect, me);

module.exports = router;
