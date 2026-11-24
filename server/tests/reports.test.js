import { registerAgent, setupApp } from "./helpers.js";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import request from "supertest";

let ctx;
let alice;
let bob;
before(async () => {
  ctx = await setupApp();
  alice = await registerAgent(request, ctx.app);
  bob = await registerAgent(request, ctx.app);
});
after(async () => { await ctx.teardown(); });

const upload = (agent, content, { name = "report.txt", type = "text/plain", reportDate } = {}) => {
  const req = agent.post("/api/reports").attach("file", Buffer.from(content), { filename: name, contentType: type });
  return reportDate ? req.field("reportDate", reportDate) : req;
};

describe("upload", () => {
  test("requires login", async () => {
    assert.equal((await request(ctx.app).get("/api/reports")).status, 401);
    assert.equal((await request(ctx.app).post("/api/reports")).status, 401);
  });

  test("analyses a report, sends the service key, stores it ENCRYPTED", async () => {
    const res = await upload(alice.agent, "Fasting Glucose 130 mg/dL", { reportDate: "2026-01-10" });
    assert.equal(res.status, 201);
    assert.equal(res.body.report.tests[0].value, 130);
    assert.equal(res.body.report.extractedText, undefined); // raw text not returned by default

    const aiCall = ctx.ai.calls.find((c) => c.url === "/api/reports/analyze");
    assert.equal(aiCall.headers["x-service-key"], process.env.AI_SERVICE_KEY);

    const raw = await ctx.mongoose.connection.db.collection("reports").findOne({});
    assert.ok(raw.payload.startsWith("k1."));
    assert.ok(!raw.payload.includes("Glucose"));          // unreadable without the key
    assert.equal(raw.patient, undefined);
  });

  test("rejects a disguised executable", async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0xff, 0xfe, 0x00]);
    const res = await alice.agent.post("/api/reports")
      .attach("file", exe, { filename: "report.pdf", contentType: "application/pdf" });
    assert.equal(res.status, 400);
  });

  test("rejects disallowed types and oversized files", async () => {
    const html = await upload(alice.agent, "<script>alert(1)</script>", { name: "x.html", type: "text/html" });
    assert.equal(html.status, 400);
    const big = await upload(alice.agent, "a".repeat(10 * 1024 * 1024 + 1));
    assert.equal(big.status, 413);
  });

  test("rejects duplicates, bad dates and passes on AI errors", async () => {
    assert.equal((await upload(alice.agent, "Fasting Glucose 130 mg/dL")).status, 409);
    assert.equal((await upload(alice.agent, "Fasting Glucose 99", { reportDate: "2999-01-01" })).status, 400);
    const unreadable = await upload(alice.agent, "UNREADABLE scan");
    assert.equal(unreadable.status, 400);
    assert.match(unreadable.body.error, /No readable text/);
  });

  test("pasted text report", async () => {
    const res = await alice.agent.post("/api/reports/text").send({ text: "Fasting Glucose 112 mg/dL", reportDate: "2026-04-10" });
    assert.equal(res.status, 201);
  });

  test("text read in the browser (OCR) keeps its extraction details + duplicate check", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    const body = {
      text: "Fasting Glucose 101 mg/dL", filename: "photo<script>.jpg", fileHash: "a".repeat(64),
      extraction: { method: "ocr", pages: 1, ocrEngine: "tesseract.js", ocrConfidence: 91.5, warnings: [] },
    };
    const res = await agent.post("/api/reports/text").send(body);
    assert.equal(res.status, 201);
    assert.equal(res.body.report.extraction.method, "ocr");
    assert.equal(res.body.report.extraction.where, "browser");
    assert.equal(res.body.report.filename, "photo_script_.jpg");         // sanitised
    assert.equal((await agent.post("/api/reports/text").send(body)).status, 409);
    const bad = await agent.post("/api/reports/text").send({ ...body, fileHash: "x", extraction: { method: "magic" } });
    assert.equal(bad.status, 400);
  });
});

describe("privacy between users", () => {
  test("Bob can't see, edit or delete Alice's reports", async () => {
    const { body } = await alice.agent.get("/api/reports");
    const id = body.reports[0].id;
    assert.equal((await bob.agent.get(`/api/reports/${id}`)).status, 404);
    assert.equal((await bob.agent.patch(`/api/reports/${id}`).send({ title: "hacked" })).status, 404);
    assert.equal((await bob.agent.delete(`/api/reports/${id}`)).status, 404);
    assert.equal((await bob.agent.get("/api/reports")).body.reports.length, 0);
  });

  test("an encrypted report copied into Bob's account can't be decrypted", async () => {
    const reports = ctx.mongoose.connection.db.collection("reports");
    const original = await reports.findOne({});
    const bobId = new ctx.mongoose.Types.ObjectId(bob.user.id);
    await reports.insertOne({ ...original, _id: new ctx.mongoose.Types.ObjectId(), user: bobId, fileHash: "copy" });
    const res = await bob.agent.get("/api/reports");
    assert.equal(res.status, 200);
    assert.equal(res.body.reports.length, 0); // auth-tag check fails -> record hidden, data stays secret
    await reports.deleteMany({ user: bobId });
  });

  test("rejects malformed ids", async () => {
    assert.equal((await alice.agent.get("/api/reports/not-an-id")).status, 400);
    assert.equal((await alice.agent.get("/api/reports/507f1f77bcf86cd799439011")).status, 404);
  });
});

describe("history dashboard", () => {
  test("list, detail, trends and insights", async () => {
    const list = await alice.agent.get("/api/reports");
    assert.equal(list.body.reports.length, 2);
    assert.equal(list.body.reports[0].reportDate.slice(0, 10), "2026-04-10"); // newest first

    const detail = await alice.agent.get(`/api/reports/${list.body.reports[0].id}?includeText=true`);
    assert.ok(detail.body.report.extractedText.includes("112"));

    const trends = await alice.agent.get("/api/reports/trends");
    assert.equal(trends.status, 200);
    assert.deepEqual(trends.body.trends.glucose.points.map((p) => p.value), [130, 112]);
    assert.ok(trends.body.insights.some((i) => i.type === "improved" && i.parameter === "Fasting Glucose"));
    assert.equal(trends.body.scoreHistory.length, 2);
  });

  test("edit title/date and delete", async () => {
    const { body } = await alice.agent.get("/api/reports");
    const id = body.reports[1].id;
    const patched = await alice.agent.patch(`/api/reports/${id}`).send({ title: "January checkup", reportDate: "2026-01-12" });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.report.title, "January checkup");
    assert.equal((await alice.agent.patch(`/api/reports/${id}`).send({})).status, 400);
    assert.equal((await alice.agent.delete(`/api/reports/${id}`)).status, 204);
    assert.equal((await alice.agent.get("/api/reports")).body.reports.length, 1);
  });

  test("demo history creates 3 reports once", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    const res = await agent.post("/api/reports/demo-history");
    assert.equal(res.status, 201);
    assert.equal(res.body.reports.length, 3);
    assert.equal((await agent.post("/api/reports/demo-history")).status, 409);
  });

  test("sample analysis is not saved", async () => {
    const { agent } = await registerAgent(request, ctx.app);
    const res = await agent.get("/api/reports/sample");
    assert.equal(res.body.sample, true);
    assert.equal((await agent.get("/api/reports")).body.reports.length, 0);
  });
});
