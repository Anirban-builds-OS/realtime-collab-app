const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { protect } = require("../middleware/auth");
const { encryptBuffer, decryptBuffer } = require("../utils/encryption");
const File = require("../models/File");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Keep uploads in memory briefly so we can encrypt before writing to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB cap per file
});

// POST /api/files/:room  — upload + encrypt a file for a room
router.post("/:room", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const { room } = req.params;
    const { iv, data } = encryptBuffer(req.file.buffer);

    const storedName = `${crypto.randomBytes(16).toString("hex")}.enc`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), data);

    const fileDoc = await File.create({
      originalName: req.file.originalname,
      storedName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      iv,
      room,
      uploadedBy: req.user._id,
    });

    return res.status(201).json({
      file: {
        id: fileDoc._id,
        name: fileDoc.originalName,
        size: fileDoc.size,
        mimeType: fileDoc.mimeType,
        uploadedBy: req.user.name,
        createdAt: fileDoc.createdAt,
      },
    });
  } catch (err) {
    console.error("[upload] error:", err.message);
    return res.status(500).json({ message: "File upload failed" });
  }
});

// GET /api/files/:room — list files shared in a room
router.get("/:room", protect, async (req, res) => {
  try {
    const files = await File.find({ room: req.params.room })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });

    return res.json({
      files: files.map((f) => ({
        id: f._id,
        name: f.originalName,
        size: f.size,
        mimeType: f.mimeType,
        uploadedBy: f.uploadedBy?.name || "Unknown",
        createdAt: f.createdAt,
      })),
    });
  } catch (err) {
    console.error("[upload] list error:", err.message);
    return res.status(500).json({ message: "Could not list files" });
  }
});

// GET /api/files/download/:id — decrypt and stream a file back to the client
router.get("/download/:id", protect, async (req, res) => {
  try {
    const fileDoc = await File.findById(req.params.id);
    if (!fileDoc) return res.status(404).json({ message: "File not found" });

    const encryptedPath = path.join(UPLOAD_DIR, fileDoc.storedName);
    if (!fs.existsSync(encryptedPath)) {
      return res.status(410).json({ message: "File data missing on server" });
    }

    const encryptedBuffer = fs.readFileSync(encryptedPath);
    const decrypted = decryptBuffer(encryptedBuffer, fileDoc.iv);

    res.setHeader("Content-Type", fileDoc.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileDoc.originalName)}"`
    );
    return res.send(decrypted);
  } catch (err) {
    console.error("[upload] download error:", err.message);
    return res.status(500).json({ message: "File download failed" });
  }
});

module.exports = router;
