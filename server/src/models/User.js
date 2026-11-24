/** User account. The password is only ever stored as a scrypt hash. */
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },

    // Bumped on "log out everywhere" / password change -> old login tokens stop working
    tokenVersion: { type: Number, default: 0 },

    // Brute-force protection: lock the account after too many wrong passwords
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    lastLoginAt: Date,
    // Wellness profile used for personalisation (all optional)
    dosha: { type: String, enum: ["vata", "pitta", "kapha", null], default: null },
  },
  { timestamps: true },
);

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

/** Only these fields are ever sent to the browser. */
userSchema.methods.toPublic = function toPublic() {
  return { id: this.id, name: this.name, email: this.email, dosha: this.dosha, createdAt: this.createdAt };
};

export const User = mongoose.model("User", userSchema);
