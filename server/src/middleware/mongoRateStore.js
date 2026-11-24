/**
 * MongoRateLimitStore - keeps express-rate-limit counters in MongoDB.
 *
 * Why: on serverless hosting (Vercel) every request can run on a different
 * instance, so counters kept in memory would reset all the time and an
 * attacker could brute-force logins. Storing them in MongoDB shares them.
 *
 * Each counter is one document: { _id: "<prefix><ip or user>", hits, resetTime }.
 * A TTL index deletes finished windows automatically.
 */
import mongoose from "mongoose";

import { logger } from "../utils/logger.js";

let indexReady = false;

export class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.localKeys = false; // tells express-rate-limit the counts are shared
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  get collection() {
    return mongoose.connection.collection("ratelimits");
  }

  async ensureIndex() {
    if (indexReady) return;
    indexReady = true;
    await this.collection.createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 }).catch((err) => {
      indexReady = false;
      logger.warn({ err }, "Could not create rate-limit TTL index");
    });
  }

  async increment(key) {
    await this.ensureIndex();
    const id = this.prefix + key;
    const now = new Date();
    // Still inside the current window -> add one hit
    const current = await this.collection.findOneAndUpdate(
      { _id: id, resetTime: { $gt: now } },
      { $inc: { hits: 1 } },
      { returnDocument: "after" },
    );
    if (current) return { totalHits: current.hits, resetTime: current.resetTime };

    // No window yet (or it expired) -> start a new one
    const resetTime = new Date(now.getTime() + this.windowMs);
    await this.collection.updateOne({ _id: id }, { $set: { hits: 1, resetTime } }, { upsert: true });
    return { totalHits: 1, resetTime };
  }

  async decrement(key) {
    await this.collection.updateOne({ _id: this.prefix + key, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await this.collection.deleteOne({ _id: this.prefix + key });
  }
}
