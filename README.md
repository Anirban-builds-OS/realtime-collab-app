# Confluence — Real-Time Communication & Collaboration App

A full-stack video conferencing + collaboration tool built to get hands-on
experience across frontend, backend, media streaming, and security:

- **Multi-user video calling** — WebRTC, full-mesh peer connections
- **Screen sharing** — `getDisplayMedia` + live track replacement
- **Shared whiteboard** — HTML canvas synced in real time over Socket.io
- **File sharing** — uploads encrypted at rest with AES-256
- **Room text chat**
- **User authentication** — JWT + bcrypt password hashing

## Architecture

```
                     ┌──────────────────────────┐
                     │      Node/Express API     │
   Browser A ───────►│  /api/auth   /api/files   │◄─────── Browser B
   (React SPA)        │  Socket.io signaling      │        (React SPA)
        │             └──────────────────────────┘             │
        │                                                       │
        └──────────────── WebRTC peer connection ───────────────┘
              (audio / video / screen — encrypted via DTLS-SRTP,
               travels directly between browsers, not through the server)
```

- **Signaling only goes through the server.** Once two browsers exchange
  SDP offers/answers and ICE candidates via Socket.io, the actual audio,
  video, and screen-share media flows **peer-to-peer**, encrypted by
  WebRTC's mandatory DTLS-SRTP. The server never sees raw media.
- **Rooms use a full-mesh topology**: every participant opens a direct
  `RTCPeerConnection` to every other participant. This is simple to
  understand and reason about, and is the standard approach for small
  group calls. (See "Production notes" below for scaling past ~6–8 people.)
- **Whiteboard strokes and chat messages** are relayed through Socket.io
  (`backend/socket/signaling.js`) since they aren't part of the WebRTC
  media stream.
- **Files** go over a normal authenticated REST upload (`multer`), get
  encrypted with AES-256-CBC before being written to disk, and are
  decrypted on download. A Socket.io event then notifies everyone else
  in the room that a new file is available.

## Project structure

```
realtime-collab-app/
├── backend/
│   ├── server.js              Express + Socket.io entrypoint
│   ├── config/db.js           MongoDB connection
│   ├── models/                User, File (mongoose schemas)
│   ├── controllers/           authController.js
│   ├── routes/                auth.js, upload.js
│   ├── middleware/auth.js     JWT-protect REST routes
│   ├── socket/signaling.js    WebRTC signaling relay, whiteboard, chat
│   ├── utils/                 generateToken.js, encryption.js (AES-256)
│   └── uploads/                encrypted file blobs live here
└── frontend/
    └── src/
        ├── pages/             Login, Register, Lobby, Room
        ├── components/        VideoGrid, VideoTile, Controls,
        │                      Whiteboard, Chat, FileShare
        ├── hooks/useWebRTC.js Peer connection + media management
        ├── context/AuthContext.jsx
        ├── socket.js          Socket.io client singleton
        └── api/axios.js       REST client with JWT interceptor
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Backend

```bash
cd backend
cp .env.example .env
# then edit .env:
#  - set MONGO_URI to your MongoDB connection string
#  - set JWT_SECRET to any long random string
#  - generate FILE_ENCRYPTION_KEY with:
#      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm install
npm run dev
```
The API + Socket.io server starts on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL defaults to http://localhost:5000
npm install
npm run dev
```
Open `http://localhost:5173`. Register an account, create a room, and
open the same room URL in a second browser (or incognito window) to test
multi-user calling.

> Camera/mic access requires either `localhost` or HTTPS — this works
> out of the box in local dev, but deploying anywhere else needs TLS
> (see below).

## How each core feature is implemented

| Feature | Where | Notes |
|---|---|---|
| Video calling | `hooks/useWebRTC.js`, `socket/signaling.js` | Full-mesh `RTCPeerConnection`s, signaled via Socket.io |
| Screen sharing | `useWebRTC.js` → `startScreenShare` | `getDisplayMedia` + `RTCRtpSender.replaceTrack` swaps the outgoing video track live, no renegotiation needed |
| Whiteboard | `components/Whiteboard.jsx` | Canvas draw events broadcast as line segments over Socket.io |
| File sharing | `routes/upload.js`, `components/FileShare.jsx` | `multer` → AES-256-CBC encrypt → disk; Socket.io notifies the room |
| Auth | `routes/auth.js`, `context/AuthContext.jsx` | JWT issued on login/register, stored client-side, sent as `Authorization: Bearer` and in the Socket.io handshake |
| Encryption | see below | Multiple layers — transport, at-rest, and password hashing |

## Security notes

- **Media (audio/video/screen)** is end-to-end encrypted in transit by
  WebRTC itself (DTLS-SRTP) — this is mandatory in the spec, not optional.
- **Passwords** are hashed with bcrypt (12 salt rounds), never stored or
  logged in plaintext.
- **REST + Socket.io traffic** is authenticated with JWTs. Socket
  connections are rejected at the handshake (`io.use(...)` middleware in
  `signaling.js`) unless a valid token is presented — there are no
  anonymous sockets.
- **Uploaded files** are encrypted at rest with AES-256-CBC using a
  server-held key (`utils/encryption.js`); each file gets its own random
  IV so identical files don't produce identical ciphertext.
- **Rate limiting** (`express-rate-limit`) is applied to `/api/auth` to
  slow down credential-stuffing/brute-force attempts.
- **Helmet** sets standard hardening HTTP headers; CORS is locked to a
  single configured `CLIENT_ORIGIN`.

### Production notes (things a real deployment would add)
- Terminate **HTTPS/WSS** in front of this server (nginx, Caddy, or a
  platform's managed TLS) — camera/mic access and secure cookies require
  it outside of `localhost`.
- Add a **TURN server** (e.g. coturn) alongside the STUN servers in
  `useWebRTC.js`. STUN alone can't traverse symmetric NATs, which a
  meaningful fraction of real users sit behind.
- Move the JWT from `localStorage` to an **httpOnly cookie** to reduce
  XSS exposure.
- Full mesh WebRTC scales to roughly 6–8 participants before each
  browser's upload bandwidth becomes the bottleneck; beyond that, an
  **SFU** (e.g. mediasoup, LiveKit) is the standard next step.

## Learning goals this project covers
- **Frontend**: React state/hooks, WebRTC browser APIs, canvas drawing, real-time UI sync
- **Backend**: REST API design, JWT auth middleware, file upload handling
- **Media streaming**: signaling protocols, ICE/STUN, peer connection lifecycle, track replacement
- **Security**: password hashing, encryption at rest, authenticated sockets, rate limiting
