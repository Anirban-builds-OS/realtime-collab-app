const demoUsers = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

module.exports = { addDemoUser, getDemoUserById, getDemoUserByEmail };
