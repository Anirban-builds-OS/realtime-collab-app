const bcrypt = require("bcryptjs");

const demoUsers = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function seedDemoUsers() {
  const seedUser = {
    _id: "demo_user",
    name: "Demo User",
    email: "test@example.com",
    password: bcrypt.hashSync("password123", 12),
  };

  const normalizedUser = {
    ...seedUser,
    email: normalizeEmail(seedUser.email),
  };

  demoUsers.set(normalizedUser._id, normalizedUser);
  return normalizedUser;
}

function addDemoUser(user) {
  const normalized = {
    ...user,
    email: normalizeEmail(user.email),
  };
  demoUsers.set(normalized._id, normalized);
  return normalized;
}

function getDemoUserById(id) {
  return demoUsers.get(String(id)) || null;
}

function getDemoUserByEmail(email) {
  const normalized = normalizeEmail(email);
  for (const user of demoUsers.values()) {
    if (user.email === normalized) return user;
  }
  return null;
}

seedDemoUsers();

module.exports = { addDemoUser, getDemoUserById, getDemoUserByEmail, seedDemoUsers };
