import "./helpers.js";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { decryptJSON, encryptJSON, hashPassword, verifyPassword } = await import("../src/services/crypto.js");
const { buildInsights, buildTrends, distanceFromNormal, reportContext } = await import("../src/services/insights.js");
const { sniffFileType } = await import("../src/middleware/upload.js");
const { passwordProblems } = await import("../src/utils/passwordPolicy.js");

describe("crypto", () => {
  test("password hash round trip, unique salts", async () => {
    const a = await hashPassword("Ginger#Tea9");
    const b = await hashPassword("Ginger#Tea9");
    assert.notEqual(a, b);
    assert.ok(await verifyPassword("Ginger#Tea9", a));
    assert.ok(!(await verifyPassword("ginger#tea9", a)));
  });

  test("AES-GCM: round trip, owner binding and tamper detection", () => {
    const secret = { tests: [{ name: "HbA1c", value: 6.4 }] };
    const enc = encryptJSON(secret, "user-1");
    assert.deepEqual(decryptJSON(enc, "user-1"), secret);
    assert.notEqual(encryptJSON(secret, "user-1"), enc);              // random IV each time
    assert.throws(() => decryptJSON(enc, "user-2"));                  // wrong owner
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered!").toString("base64url");
    assert.throws(() => decryptJSON(parts.join("."), "user-1"));      // tampered data
  });
});

describe("insights", () => {
  const report = (date, value, low = 70, high = 99) => ({
    reportDate: date,
    tests: [{ key: "glucose", name: "Fasting Glucose", unit: "mg/dL", value, low, high,
      status: value > high ? "high" : value < low ? "low" : "normal" }],
  });

  test("distance from normal range", () => {
    assert.equal(distanceFromNormal({ value: 90, low: 70, high: 99 }), 0);
    assert.ok(distanceFromNormal({ value: 120, low: 70, high: 99 }) > 0.2);
    assert.equal(distanceFromNormal({ value: 45, low: 40, high: null }), 0);
  });

  test("trends are sorted by date", () => {
    const t = buildTrends([report("2026-03-01", 110), report("2026-01-01", 130)]);
    assert.deepEqual(t.glucose.points.map((p) => p.value), [130, 110]);
  });

  test("improved / back to normal / worsened / 3-report pattern", () => {
    const back = buildInsights(buildTrends([report("2026-01-01", 120), report("2026-02-01", 95)]));
    assert.match(back[0].message, /back in the normal range/);
    const worse = buildInsights(buildTrends([report("2026-01-01", 95), report("2026-02-01", 130)]));
    assert.equal(worse[0].type, "worsened");
    const rising = buildInsights(buildTrends([report("2026-01-01", 105), report("2026-02-01", 115), report("2026-03-01", 125)]));
    assert.ok(rising.some((i) => i.type === "pattern" && /rising/.test(i.message)));
  });

  test("report context only lists abnormal values", () => {
    const r = { ...report("2026-02-01", 130), concerns: [{ name: "Diabetes" }] };
    assert.match(reportContext(r), /Fasting Glucose: 130 mg\/dL \(high; normal 70-99\)/);
    assert.equal(reportContext(report("2026-02-01", 90)), null);
    assert.equal(reportContext(null), null);
  });
});

describe("file sniffing & password policy", () => {
  test("detects real file types", () => {
    assert.equal(sniffFileType(Buffer.from("%PDF-1.7")), "application/pdf");
    assert.equal(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(sniffFileType(Buffer.from("Hemoglobin 13 g/dL — सामान्य")), "text/plain");
    assert.equal(sniffFileType(Buffer.from([0x4d, 0x5a, 0x00, 0x01])), null);
  });

  test("password rules", () => {
    assert.equal(passwordProblems("Turmeric#Milk42"), null);
    assert.ok(passwordProblems("password123"));
    assert.ok(passwordProblems("abcdefgh"));
    assert.ok(passwordProblems("rahul2024!", { email: "rahul@x.com" }));
  });
});
