/** Turn any error into a clean JSON response. Internal details never leak. */
import mongoose from "mongoose";

import { logger } from "../utils/logger.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "API route not found", code: "NOT_FOUND" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  let status = error.status || error.statusCode || 500;
  let message = error.expose ? error.message : "Something went wrong. Please try again.";
  let code = error.code && typeof error.code === "string" ? error.code : undefined;

  if (error instanceof mongoose.Error.CastError) {
    status = 404;
    message = "Not found";
    code = "NOT_FOUND";
  } else if (error.type === "entity.too.large") {
    status = 413;
    message = "Request is too large";
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON";
  }

  if (status >= 500) logger.error({ err: error, requestId: req.id }, "Unhandled error");

  res.status(status).json({ error: message, code, requestId: req.id });
}
