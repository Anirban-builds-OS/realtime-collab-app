const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { getDemoUserById } = require("../utils/demoUsers");

// room -> Set of { socketId, userId, name }
const roomMembers = new Map();

function addMember(room, member) {
  if (!roomMembers.has(room)) roomMembers.set(room, new Map());
  roomMembers.get(room).set(member.socketId, member);
}

function removeMember(room, socketId) {
  const members = roomMembers.get(room);
  if (!members) return;
  members.delete(socketId);
  if (members.size === 0) roomMembers.delete(room);
}

function getOtherMembers(room, socketId) {
  const members = roomMembers.get(room);
  if (!members) return [];
  return [...members.values()].filter((m) => m.socketId !== socketId);
}

/**
 * Attaches all real-time collaboration behaviour to a Socket.io server:
 *  - JWT authentication on the handshake (no anonymous sockets)
 *  - WebRTC mesh signaling relay (offer/answer/ICE candidates)
 *  - Shared whiteboard drawing sync
 *  - Room text chat
 *  - Screen-share start/stop notifications
 */
function attachSignaling(io) {
  // Authenticate every socket connection using the same JWT issued by /api/auth
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const dbReady = mongoose.connection.readyState === 1;
      let user = null;

      if (dbReady) {
        user = await User.findById(decoded.id);
      } else {
        user = getDemoUserById(decoded.id);
      }

      if (!user) return next(new Error("Authentication required"));

      socket.user = { id: user._id.toString(), name: user.name };
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    let currentRoom = null;

    socket.on("join-room", ({ room }) => {
      if (!room) return;
      currentRoom = room;
      socket.join(room);

      const member = { socketId: socket.id, userId: socket.user.id, name: socket.user.name };
      const existingPeers = getOtherMembers(room, socket.id);
      addMember(room, member);

      // Tell the newcomer who is already in the room, so it can initiate
      // an RTCPeerConnection + offer to each existing peer (mesh topology).
      socket.emit("existing-peers", existingPeers);

      // Tell everyone already in the room that someone new joined.
      socket.to(room).emit("user-joined", member);
    });

    // Generic WebRTC signaling relay: offers, answers, and ICE candidates
    // are all opaque to the server — it just forwards them to the target peer.
    socket.on("signal", ({ to, signalData }) => {
      if (!to || !signalData) return;
      io.to(to).emit("signal", {
        from: socket.id,
        fromName: socket.user.name,
        signalData,
      });
    });

    socket.on("whiteboard-draw", ({ room, stroke }) => {
      if (!room || !stroke) return;
      socket.to(room).emit("whiteboard-draw", stroke);
    });

    socket.on("whiteboard-clear", ({ room }) => {
      if (!room) return;
      socket.to(room).emit("whiteboard-clear");
    });

    socket.on("chat-message", ({ room, message }) => {
      if (!room || !message) return;
      io.to(room).emit("chat-message", {
        from: socket.user.name,
        message,
        timestamp: Date.now(),
      });
    });

    socket.on("file-shared", ({ room, file }) => {
      if (!room || !file) return;
      socket.to(room).emit("file-shared", { ...file, sharedBy: socket.user.name });
    });

    socket.on("screen-share-status", ({ room, sharing }) => {
      if (!room) return;
      socket.to(room).emit("screen-share-status", {
        socketId: socket.id,
        name: socket.user.name,
        sharing: !!sharing,
      });
    });

    socket.on("leave-room", () => leaveCurrentRoom());
    socket.on("disconnect", () => leaveCurrentRoom());

    function leaveCurrentRoom() {
      if (!currentRoom) return;
      removeMember(currentRoom, socket.id);
      socket.to(currentRoom).emit("user-left", { socketId: socket.id });
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });
}

module.exports = attachSignaling;
