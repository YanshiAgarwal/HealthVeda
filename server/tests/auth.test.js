import { STRONG_PASSWORD, registerAgent, setupApp } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import jwt from "jsonwebtoken";
import request from "supertest";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.teardown(); });

const cookieValue = (res, name) =>
  res.headers["set-cookie"]?.find((c) => c.startsWith(`${name}=`))?.split(";")[0].split("=")[1];

describe("register", () => {
  test("creates the account and sets secure cookies", async () => {
    const res = await request(ctx.app).post("/api/auth/register")
      .send({ name: "Asha Verma", email: "Asha@Test.com", password: STRONG_PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "asha@test.com");          // normalised
    assert.equal(res.body.user.passwordHash, undefined);          // never leaked
    const cookies = res.headers["set-cookie"].join(";");
    assert.match(cookies, /hv_access=.*HttpOnly/i);
    assert.match(cookies, /SameSite=Strict/i);
    assert.match(cookies, /hv_refresh=.*Path=\/api\/auth/i);
  });

  test("rejects weak, common and personal passwords", async () => {
    for (const password of ["short1", "password123", "nonumbersatall", "ashaverma99x"]) {
      const res = await request(ctx.app).post("/api/auth/register")
        .send({ name: "Asha Verma", email: `w${Math.random()}@t.com`, password });
      assert.equal(res.status, 400, password);
    }
  });

  test("rejects duplicate email", async () => {
    const res = await request(ctx.app).post("/api/auth/register")
      .send({ name: "Other", email: "asha@test.com", password: STRONG_PASSWORD });
    assert.equal(res.status, 409);
  });

  test("rejects unknown fields (mass assignment)", async () => {
    const res = await request(ctx.app).post("/api/auth/register")
      .send({ name: "X Y", email: "x@t.com", password: STRONG_PASSWORD, tokenVersion: 99, role: "admin" });
    assert.equal(res.status, 400);
  });
});

describe("login", () => {
  test("same error for wrong password and unknown email", async () => {
    const a = await request(ctx.app).post("/api/auth/login").send({ email: "asha@test.com", password: "Wrong1234" });
    const b = await request(ctx.app).post("/api/auth/login").send({ email: "nobody@test.com", password: "Wrong1234" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error);
  });

  test("blocks NoSQL injection payloads", async () => {
    const res = await request(ctx.app).post("/api/auth/login")
      .send({ email: { $ne: "" }, password: { $ne: "" } });
    assert.equal(res.status, 400);
  });

  test("succeeds with correct password", async () => {
    const res = await request(ctx.app).post("/api/auth/login").send({ email: "ASHA@test.com", password: STRONG_PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(cookieValue(res, "hv_access"));
  });

  test("locks the account after 5 wrong passwords", async () => {
    const { email } = await registerAgent(request, ctx.app);
    for (let i = 0; i < 5; i++) {
      await request(ctx.app).post("/api/auth/login").send({ email, password: "Wrong1234" });
    }
    const res = await request(ctx.app).post("/api/auth/login").send({ email, password: STRONG_PASSWORD });
    assert.equal(res.status, 429);
    assert.equal(res.body.code, "ACCOUNT_LOCKED");
  });
});

describe("sessions", () => {
  test("/me needs a valid login", async () => {
    assert.equal((await request(ctx.app).get("/api/auth/me")).status, 401);
    const { agent } = await registerAgent(request, ctx.app);
    assert.equal((await agent.get("/api/auth/me")).status, 200);
  });

  test("rejects forged and 'alg:none' tokens", async () => {
    const forged = jwt.sign({ sub: "000000000000000000000000", tv: 0 }, "attacker-secret-attacker-secret-1234",
      { issuer: "healthveda", audience: "healthveda-web" });
    const none = jwt.sign({ sub: "000000000000000000000000", tv: 0 }, null, { algorithm: "none" });
    for (const token of [forged, none, "garbage"]) {
      const res = await request(ctx.app).get("/api/auth/me").set("Cookie", `hv_access=${token}`);
      assert.equal(res.status, 401);
    }
  });

  test("refresh rotates the token and detects reuse (theft)", async () => {
    const reg = await request(ctx.app).post("/api/auth/register")
      .send({ name: "Ravi Kumar", email: "ravi@test.com", password: STRONG_PASSWORD });
    const firstRefresh = cookieValue(reg, "hv_refresh");

    const r1 = await request(ctx.app).post("/api/auth/refresh").set("Cookie", `hv_refresh=${firstRefresh}`);
    assert.equal(r1.status, 200);
    const secondRefresh = cookieValue(r1, "hv_refresh");
    assert.notEqual(secondRefresh, firstRefresh);

    // Attacker replays the OLD token -> rejected, and the whole family is revoked
    const replay = await request(ctx.app).post("/api/auth/refresh").set("Cookie", `hv_refresh=${firstRefresh}`);
    assert.equal(replay.status, 401);
    assert.equal(replay.body.code, "SESSION_REUSED");
    const legit = await request(ctx.app).post("/api/auth/refresh").set("Cookie", `hv_refresh=${secondRefresh}`);
    assert.equal(legit.status, 401);
  });

  test("logout-all invalidates existing access tokens", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    const other = request.agent(ctx.app);
    const me = await agent.get("/api/auth/me");
    await other.post("/api/auth/login").send({ email: me.body.user.email, password: STRONG_PASSWORD });

    assert.equal((await agent.post("/api/auth/logout-all")).status, 200);
    assert.equal((await other.get("/api/auth/me")).status, 401);
  });
});

describe("web security", () => {
  test("blocks cross-site POST (CSRF)", async () => {
    const res = await request(ctx.app).post("/api/auth/login")
      .set("Origin", "https://evil.example").send({ email: "a@b.com", password: "x" });
    assert.equal(res.status, 403);
  });

  test("allows our own origin", async () => {
    const res = await request(ctx.app).post("/api/auth/login")
      .set("Origin", "http://localhost:5173").send({ email: "asha@test.com", password: STRONG_PASSWORD });
    assert.equal(res.status, 200);
  });

  test("sends security headers and no-store", async () => {
    const res = await request(ctx.app).get("/api/status");
    assert.match(res.headers["content-security-policy"], /default-src 'self'/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-powered-by"], undefined);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.ok(res.headers["x-request-id"]);
  });

  test("hides internal errors and unknown routes", async () => {
    const res = await request(ctx.app).get("/api/does-not-exist");
    assert.equal(res.status, 404);
    const bad = await request(ctx.app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.stack, undefined);
  });
});
