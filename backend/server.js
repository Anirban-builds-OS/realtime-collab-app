require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const attachSignaling = require("./socket/signaling");

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// --- Security middleware -----------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// --- Database ------------------------------------------------------------
connectDB();

// --- REST routes -----------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/files", uploadRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Socket.io (signaling, whiteboard, chat) --------------------------------
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});
attachSignaling(io);

// --- Error handling ----------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT} (client origin: ${CLIENT_ORIGIN})`);
  console.log(
    "[server] NOTE: run this behind HTTPS/WSS (e.g. via nginx, Caddy, or a platform's " +
      "managed TLS) in production so Socket.io and REST traffic are encrypted in transit."
  );
});
