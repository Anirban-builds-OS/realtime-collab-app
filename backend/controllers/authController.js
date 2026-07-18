const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { addDemoUser, getDemoUserByEmail } = require("../utils/demoUsers");

const inMemoryUsers = [];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function buildUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = normalizeEmail(email);
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const existing = getDemoUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ message: "An account with that email already exists" });
      }

      const user = {
        _id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: String(name).trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 12),
      };

      addDemoUser(user);
      inMemoryUsers.push(user);

      return res.status(201).json({
        user: buildUserResponse(user),
        token: generateToken(user._id),
      });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists" });
    }

    const user = await User.create({ name, email: normalizedEmail, password });

    return res.status(201).json({
      user: buildUserResponse(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("[auth] register error:", err.message);
    return res.status(500).json({ message: "Server error during registration" });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const user = getDemoUserByEmail(normalizedEmail);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.json({
        user: buildUserResponse(user),
        token: generateToken(user._id),
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({
      user: buildUserResponse(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("[auth] login error:", err.message);
    return res.status(500).json({ message: "Server error during login" });
  }
}

// GET /api/auth/me
async function me(req, res) {
  return res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email },
  });
}

module.exports = { register, login, me };
