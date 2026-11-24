/**
 * serverless.js - entry point for Vercel (and other serverless hosts).
 *
 * Locally we use index.js (connect once, then app.listen). On Vercel there is
 * no long-running process: the platform calls the exported Express app for
 * each request. So we connect to MongoDB lazily on the first request and
 * re-use that connection while the instance stays warm.
 */
import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";

let connection; // shared by every request handled by this instance

async function connectOnce() {
  connection ??= connectDatabase().catch((error) => {
    connection = undefined; // allow a retry on the next request
    throw error;
  });
  return connection;
}

const app = createApp({ beforeRoutes: connectOnce });

export default app;
