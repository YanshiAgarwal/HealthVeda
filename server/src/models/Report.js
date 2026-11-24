/**
 * A saved lab report.
 *
 * PRIVACY: everything medical (values, summary, patient name, file name, text)
 * lives inside `payload`, which is AES-256-GCM encrypted (see services/crypto.js).
 * Only non-identifying metadata is stored in plain form so we can sort/filter.
 */
import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportDate: { type: Date, required: true },   // date the test was done (for trends)
    payload: { type: String, required: true },    // encrypted JSON
    fileHash: { type: String },                   // SHA-256 of the upload (duplicate detection)
  },
  { timestamps: true },
);

reportSchema.index({ user: 1, reportDate: -1 });
reportSchema.index({ user: 1, fileHash: 1 });

export const Report = mongoose.model("Report", reportSchema);
