/** db.js - connect to MongoDB with safe defaults. */
import mongoose from "mongoose";

import { config } from "./env.js";
import { logger } from "../utils/logger.js";

// Security: strip MongoDB operators ($gt, $where...) from query filters,
// so user input can never turn into a NoSQL-injection query.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export async function connectDatabase(uri = config.MONGODB_URI) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: true, // creates our indexes (unique email, TTL expiry of sessions/logs)
  });
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
