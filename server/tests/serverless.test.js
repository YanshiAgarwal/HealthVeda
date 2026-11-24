// Serverless mode (Vercel): lazy DB connection + rate limits shared through MongoDB.
import { startMockAi } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

process.env.RATE_LIMIT_STORE = "mongo";
process.env.TEST_RATE_LIMITS = "1"; // turn rate limits ON for this file

let ai;
let instanceA;
let instanceB;
let mongoose;

before(async () => {
  ai = await startMockAi();
  instanceA = (await import("../src/serverless.js")).default;
  // A second, independent app = a second serverless instance
  const { createApp } = await import("../src/app.js");
  instanceB = createApp();
  mongoose = (await import("mongoose")).default;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await ai.close();
});

test("connects to MongoDB lazily on the first API request", async () => {
  assert.equal(mongoose.connection.readyState, 0); // not connected yet
  const started = Date.now();
  const res = await request(instanceA).get("/api/status");
  assert.equal(res.status, 200);
  // Must connect BEFORE the rate limiter touches MongoDB (no 10 s buffering stall)
  assert.ok(Date.now() - started < 3000, `cold start took ${Date.now() - started} ms`);
  assert.equal(mongoose.connection.readyState, 1);
  await mongoose.connection.dropDatabase();
});

test("health check works without the database", async () => {
  assert.equal((await request(instanceA).get("/api/health")).body.status, "ok");
});

test("login rate limit is shared between instances (stored in MongoDB)", async () => {
  const attempt = (app) =>
    request(app).post("/api/auth/login").set("X-Forwarded-For", "1.2.3.4")
      .send({ email: "nobody@test.com", password: "Wrong1234" });

  for (let i = 0; i < 6; i++) assert.equal((await attempt(instanceA)).status, 401);
  for (let i = 0; i < 4; i++) assert.equal((await attempt(instanceB)).status, 401);

  // 11th attempt - on EITHER instance - is blocked
  const blocked = await attempt(instanceB);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "RATE_LIMITED");
  assert.equal((await attempt(instanceA)).status, 429);

  const counters = await mongoose.connection.collection("ratelimits").find({ _id: /^auth:/ }).toArray();
  assert.equal(counters.length, 1);
  assert.ok(counters[0].resetTime > new Date());
});
