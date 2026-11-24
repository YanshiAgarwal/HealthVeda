/**
 * A login session = one refresh token (one per device/browser).
 * We store only the SHA-256 HASH of the token, never the token itself.
 * Refresh tokens are ROTATED on every use; re-using an old one means it was
 * stolen, so every session of that user is revoked.
 */
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true }, // all rotations of one login
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: true },
);

// MongoDB deletes expired sessions automatically (TTL index)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model("Session", sessionSchema);
