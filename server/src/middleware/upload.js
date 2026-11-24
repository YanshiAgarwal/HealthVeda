/**
 * Safe file uploads.
 *  - kept in memory only (never written to disk on our server)
 *  - max MAX_UPLOAD_MB (10 MB locally, 4 MB on Vercel), exactly one file
 *  - the file's REAL type is checked from its first bytes ("magic bytes"),
 *    so renaming virus.exe to report.pdf doesn't work
 */
import multer from "multer";

import { config } from "../config/env.js";
import { AppError, badRequest } from "../utils/AppError.js";

export const MAX_UPLOAD_BYTES = config.MAX_UPLOAD_MB * 1024 * 1024;

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, fieldSize: 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(badRequest("Please upload a PDF, PNG, JPG, WEBP or TXT file.", "BAD_FILE_TYPE")),
}).single("file");

/** Detect the real file type from its content. */
export function sniffFileType(buffer) {
  if (buffer.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  const sample = buffer.subarray(0, 4096);
  if (sample.length && !sample.includes(0)) {
    try {
      // fatal = reject invalid UTF-8; stream = allow a character cut at the 4 KB edge
      new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
      return "text/plain";
    } catch {
      return null;
    }
  }
  return null;
}

export function uploadReport(req, res, next) {
  parser(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" ? `File is too large (max ${config.MAX_UPLOAD_MB} MB).` : "Invalid upload.";
      return next(new AppError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, message, "BAD_UPLOAD"));
    }
    if (error) return next(error);
    if (!req.file) return next(badRequest("Please choose a file to upload.", "NO_FILE"));

    const realType = sniffFileType(req.file.buffer);
    if (!realType) return next(badRequest("This file type isn't supported or the file is damaged.", "BAD_FILE_TYPE"));
    req.file.detectedType = realType;
    next();
  });
}
