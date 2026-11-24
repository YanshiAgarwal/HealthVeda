/**
 * index.js - starts the server.
 *   npm run dev    (auto-restarts when you edit files)
 *   npm start      (production)
 */
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { logger } from "./utils/logger.js";

await connectDatabase();

const server = createApp().listen(config.PORT, () => {
  logger.info(`HealthVeda server running on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});
server.requestTimeout = 200_000; // OCR of a long scanned PDF can take a while

// Graceful shutdown: finish current requests, then close the database
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (err) => logger.error({ err }, "Unhandled promise rejection"));
