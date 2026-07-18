const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";

/**
 * Loads and validates the 32-byte AES key from the environment.
 * The key is stored as a 64-character hex string in .env.
 */
function getKey() {
  const hex = process.env.FILE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "FILE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a Buffer and returns { iv, data } — both needed to decrypt later.
 * A random IV is generated per file so identical files don't produce
 * identical ciphertext.
 */
function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { iv: iv.toString("hex"), data: encrypted };
}

/**
 * Decrypts a Buffer given the hex IV that was generated at encryption time.
 */
function decryptBuffer(encryptedBuffer, ivHex) {
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

module.exports = { encryptBuffer, decryptBuffer };
