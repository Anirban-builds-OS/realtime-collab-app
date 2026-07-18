const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // name on disk (encrypted blob)
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    iv: { type: String, required: true }, // AES IV, needed to decrypt
    room: { type: String, required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("File", fileSchema);
