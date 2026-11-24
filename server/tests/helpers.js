/**
 * Test helpers. Import this FIRST in every test file - it sets a safe test
 * environment before the app reads its config.
 */
import http from "node:http";

const dbName = `healthveda_test_${process.pid}`;
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: `mongodb://127.0.0.1:27017/${dbName}`,
  JWT_ACCESS_SECRET: "test-jwt-secret-test-jwt-secret-test-jwt-secret",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  AI_SERVICE_KEY: "test-ai-service-key-test-ai-service-key",
  CLIENT_ORIGINS: "http://localhost:5173",
  SCRYPT_COST: "1024", // fast hashing for tests only
  LOG_LEVEL: "silent",
});

/** A fake Python AI service that records every call it receives. */
export async function startMockAi() {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    calls.push({ url: req.url, method: req.method, headers: req.headers, body });

    const send = (obj, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (req.headers["x-service-key"] !== process.env.AI_SERVICE_KEY) return send({ detail: "Invalid service key" }, 401);

    if (req.url === "/api/status") return send({ ai_enabled: true, search_mode: "rag", ocr_engine: "rapidocr" });
    if (req.url === "/api/reports/analyze-text") return send(fakeAnalysis(JSON.parse(body).text));
    if (req.url === "/api/reports/analyze") {
      const text = body.toString("latin1");
      if (text.includes("UNREADABLE")) return send({ detail: "No readable text was found in this file." }, 400);
      return send(fakeAnalysis(text));
    }
    if (req.url === "/api/reports/sample") return send(fakeAnalysis("Fasting Glucose 118"));
    if (req.url === "/api/chat") {
      return send({ answer: "Sip warm ginger water.", condition: "Cough", source: "ayurveda book",
        emergency: false, profile: { disease: "Cough" }, mode: "rag" });
    }
    if (req.url.startsWith("/api/conditions")) return send([{ disease: "Cough", symptoms: "cough" }]);
    return send({ detail: "Not found" }, 404);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  return { calls, close: () => new Promise((r) => server.close(r)), server };
}

/** Very small imitation of the real analyzer: understands "Fasting Glucose N". */
function fakeAnalysis(text) {
  const glucose = Number(/Fasting Glucose (\d+)/i.exec(text)?.[1] ?? 90);
  const status = glucose > 99 ? "high" : "normal";
  return {
    patient: { name: "Test Patient" },
    tests: [{ key: "glucose", name: "Fasting Glucose", category: "Sugar", value: glucose, unit: "mg/dL",
      low: 70, high: 99, range_source: "report", status, severity: status === "normal" ? "normal" : "abnormal", info: "" }],
    concerns: status === "high" ? [{ name: "Diabetes", evidence: [], severity: "abnormal", ayurveda: null }] : [],
    categories: [{ category: "Sugar", total: 1, normal: status === "normal" ? 1 : 0 }],
    summary: { overview: "Test overview", key_points: [], recommendations: [], doctor_questions: [] },
    health_score: status === "normal" ? 100 : 25,
    risk_level: status === "normal" ? "Low" : "High",
    ai_powered: false,
    extraction: { method: "text", warnings: [] },
    extracted_text: text.slice(0, 200),
    disclaimer: "info only",
  };
}

/** Start the app on a fresh test database. */
export async function setupApp() {
  const ai = await startMockAi();
  const { createApp } = await import("../src/app.js");
  const { connectDatabase } = await import("../src/config/db.js");
  const mongoose = (await import("mongoose")).default;
  await connectDatabase(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  const app = createApp();
  return {
    app,
    ai,
    mongoose,
    async teardown() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await ai.close();
    },
  };
}

export const STRONG_PASSWORD = "Turmeric#Milk42";

/** Register a user and return a supertest agent that keeps their cookies. */
export async function registerAgent(request, app, email = `user${Math.random().toString(36).slice(2)}@test.com`) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send({ name: "Asha Verma", email, password: STRONG_PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, email, user: res.body.user };
}
