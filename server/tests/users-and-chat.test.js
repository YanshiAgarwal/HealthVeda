import { STRONG_PASSWORD, registerAgent, setupApp } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import request from "supertest";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.teardown(); });

describe("account", () => {
  test("update profile, only allowed fields", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    const ok = await agent.patch("/api/users/me").send({ name: "Asha V", dosha: "pitta" });
    assert.equal(ok.body.user.dosha, "pitta");
    assert.equal((await agent.patch("/api/users/me").send({ email: "evil@x.com" })).status, 400);
  });

  test("change password logs out other devices", async () => {
    const { agent, email } = await registerAgent(request, ctx.app);
    const phone = request.agent(ctx.app);
    await phone.post("/api/auth/login").send({ email, password: STRONG_PASSWORD });

    const wrong = await agent.post("/api/users/me/password").send({ currentPassword: "nope", newPassword: "NewTulsi#Leaf77" });
    assert.equal(wrong.status, 401);
    const res = await agent.post("/api/users/me/password").send({ currentPassword: STRONG_PASSWORD, newPassword: "NewTulsi#Leaf77" });
    assert.equal(res.status, 200);

    assert.equal((await phone.get("/api/auth/me")).status, 401);   // other device logged out
    assert.equal((await agent.get("/api/auth/me")).status, 200);   // this one stays in
    const login = await request(ctx.app).post("/api/auth/login").send({ email, password: "NewTulsi#Leaf77" });
    assert.equal(login.status, 200);
  });

  test("sessions, activity log and data export", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    await agent.post("/api/reports/text").send({ text: "Fasting Glucose 140 mg/dL" });

    assert.equal((await agent.get("/api/users/me/sessions")).body.sessions.length, 1);
    const actions = (await agent.get("/api/users/me/activity")).body.activity.map((a) => a.action);
    assert.ok(actions.includes("auth.register") && actions.includes("report.create"));

    const exp = await agent.get("/api/users/me/export");
    assert.match(exp.headers["content-disposition"], /attachment/);
    assert.equal(exp.body.reports[0].tests[0].value, 140);       // decrypted for the owner
  });

  test("delete account needs password + confirmation and erases data", async () => {
    const { agent, email } = await registerAgent(request, ctx.app);
    await agent.post("/api/reports/text").send({ text: "Fasting Glucose 140 mg/dL" });

    assert.equal((await agent.delete("/api/users/me").send({ password: STRONG_PASSWORD })).status, 400);
    assert.equal((await agent.delete("/api/users/me").send({ password: "wrong", confirm: "DELETE" })).status, 401);
    const res = await agent.delete("/api/users/me").send({ password: STRONG_PASSWORD, confirm: "DELETE" });
    assert.equal(res.status, 204);

    const db = ctx.mongoose.connection.db;
    assert.equal(await db.collection("users").countDocuments({ email }), 0);
    assert.equal((await agent.get("/api/auth/me")).status, 401);
  });
});

describe("chat + Ayurveda", () => {
  test("chat requires login", async () => {
    assert.equal((await request(ctx.app).post("/api/chat").send({ message: "cough" })).status, 401);
  });

  test("combines symptoms with the latest report", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    await agent.post("/api/reports/text").send({ text: "Fasting Glucose 150 mg/dL", reportDate: "2026-05-01" });

    const res = await agent.post("/api/chat").send({ message: "I have a cough", language: "Hindi" });
    assert.equal(res.status, 200);
    assert.equal(res.body.condition, "Cough");
    const sent = JSON.parse(ctx.ai.calls.findLast((c) => c.url === "/api/chat").body);
    assert.match(sent.report_context, /Fasting Glucose: 150 mg\/dL \(high/);
    assert.equal(sent.language, "Hindi");

    await agent.post("/api/chat").send({ message: "I have a cough", useReport: false });
    const sent2 = JSON.parse(ctx.ai.calls.findLast((c) => c.url === "/api/chat").body);
    assert.equal(sent2.report_context, null);
  });

  test("validates chat input", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    assert.equal((await agent.post("/api/chat").send({ message: "" })).status, 400);
    assert.equal((await agent.post("/api/chat").send({ message: "hi", language: "<script>" })).status, 400);
  });

  test("public remedy explorer + status", async () => {
    assert.equal((await request(ctx.app).get("/api/conditions?search=cough")).body[0].disease, "Cough");
    assert.equal((await request(ctx.app).get("/api/conditions?limit=9999")).status, 400);
    const status = await request(ctx.app).get("/api/status");
    assert.equal(status.body.ai.online, true);
  });

  test("reports a friendly error when the AI service is down", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    await ctx.ai.close();
    const res = await agent.post("/api/chat").send({ message: "cough", useReport: false });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "AI_UNAVAILABLE");
    ctx.ai.close = async () => {}; // already closed
  });
});
