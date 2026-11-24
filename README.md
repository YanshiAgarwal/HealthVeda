# 🌿 HealthVeda

**AI-Powered Medical Report Analyzer & Ayurvedic Wellness Recommendation Platform**
*Final Year Project – B.Tech CSE, Session 2025-26*

HealthVeda helps people **understand their lab reports**, **keep their medical history in one secure place**,
and get **Ayurvedic diet & lifestyle guidance** that takes both their symptoms *and* their reports into account.

> ⚠️ HealthVeda supports health awareness. It does **not** replace a doctor's diagnosis or treatment.

---

## ✨ Features (mapped to the synopsis)

| Synopsis | What HealthVeda does |
|---|---|
| **AI-based medical report analysis** | Upload a **digital PDF, scanned PDF or phone photo**. It is read **in your browser** (pdf.js + tesseract.js OCR with image clean-up) - the file never leaves your device. 23 lab markers are extracted, compared with the **reference ranges printed on your report** (or standard ranges), and explained in simple words with a health score, charts and an AI summary. Suspicious OCR values (e.g. a lost decimal point) are flagged for you to double-check. |
| **Centralized medical history dashboard** | Every report is saved (encrypted) to your account. The dashboard shows your **health score over time**, **trend charts per parameter** with the normal range shaded, and the list of all reports. |
| **Integrated Ayurvedic recommendations** | Each abnormal result links to its Ayurvedic profile (herbs, diet, yoga, prevention). The **Veda Assistant** chatbot combines your **symptoms + latest report** (e.g. avoids sugary remedies if your sugar is high). |
| **Personalized health insights** | "Glucose is improving (126 → 108) but still high", "Vitamin D has been falling across 3 reports"… generated from your own history. |
| **Curated knowledge base + safety** | 446-condition Ayurveda dataset + an Ayurveda book searched with RAG; emergency symptoms are detected first (call 112 / 108). |
| **Privacy & security of records** | AES-256-GCM encryption at rest, secure login, audit log, data export and account deletion – see [docs/SECURITY.md](docs/SECURITY.md). |
| *Future scope: multilingual* | **Already done:** chat in 10 Indian languages, voice input & read-aloud. |

Also included: **Dosha (Prakriti) quiz**, **Remedy Explorer**, **Wellness tools** (BMI, water, Dinacharya),
and terminal **voice** + **phone-call** modes.

---

## 🏗️ Architecture (MERN + AI service)

```
┌──────────────┐  HTTPS   ┌──────────────────────────┐        ┌───────────┐
│ React client │ ───────► │ Node.js + Express server │ ─────► │  MongoDB  │
│  (Vite)      │ cookies  │  auth · history · gateway │        │ encrypted │
└──────────────┘          └────────────┬─────────────┘        └───────────┘
                                       │ X-Service-Key (internal only)
                          ┌────────────▼─────────────┐
                          │  Python AI service        │──► Groq LLM API
                          │  OCR · report analysis    │
                          │  Ayurveda RAG (Chroma)    │
                          └──────────────────────────┘
```

| Layer | Technology |
|---|---|
| **Client** | React 18, Vite, Tailwind CSS, React Router, Framer Motion, Recharts, Web Speech API, **pdf.js + tesseract.js (in-browser OCR)** |
| **Server** | Node.js, Express 5, MongoDB + Mongoose, JWT, scrypt, AES-256-GCM, Helmet, zod, Multer, pino |
| **AI service** | Python, FastAPI, Groq LLM, BGE embeddings (ONNX via fastembed, or torch), BM25, ChromaDB + re-ranker (full mode), OpenCV / Tesseract / RapidOCR (server OCR, full mode) |
| **Hosting** | **Vercel** (web + API + AI as Services) + **MongoDB Atlas**, or Docker compose |
| **DevOps** | GitHub Actions CI, Node test runner, pytest, npm audit, pip-audit |

---

## 📁 Project structure

```
HealthVeda/
├── client/                    ← React website
│   └── src/
│       ├── api/healthveda.js       ALL calls to the server (auto token refresh)
│       ├── ocr/                    in-browser report reading: pdf.js, tesseract.js, image clean-up
│       ├── context/                AuthContext (who is logged in), ThemeContext
│       ├── pages/                  Home, AuthPage, Dashboard, ReportAnalyzer, ReportView,
│       │                           VedaAssistant, Account, DoshaQuiz, RemedyExplorer, Wellness
│       └── components/             auth/ · common/ · dashboard/ · layout/ · report/
│
├── server/                    ← Node.js + Express + MongoDB (the main API)
│   ├── src/
│   │   ├── app.js                  START HERE: security layers + routes
│   │   ├── index.js                starts the server locally
│   │   ├── serverless.js           Vercel entry (lazy DB connection), used by server.js
│   │   ├── config/                 env.js (validated settings), db.js
│   │   ├── models/                 User, Session, Report (encrypted), AuditLog
│   │   ├── routes/ → controllers/  auth · reports · users · ai (chat, remedies)
│   │   ├── middleware/             auth, validation, rate limits, uploads, CSRF, errors
│   │   └── services/               crypto, session, aiClient, reportStore, insights, audit
│   └── tests/                      50 automated tests
│
├── ai-service/                ← Python AI (internal only)
│   ├── main.py                     START HERE
│   ├── security.py                 service-key check
│   ├── services/
│   │   ├── document_reader.py      PDF / scanned PDF / photo → text (OpenCV + OCR)
│   │   ├── report_analyzer.py      values, printed ranges, OCR sanity checks, score, summary
│   │   ├── search_lite.py          serverless search: NumPy vectors + ONNX + BM25 (RRF)
│   │   ├── lab_reference.py        23 lab tests and their normal ranges
│   │   ├── ayurveda_rag.py         the chatbot brain (RAG)
│   │   └── ayurveda_knowledge.py   the Ayurveda dataset
│   ├── vector_index/               light vector index used on Vercel (exported from vector_db/)
│   ├── requirements.txt            LIGHT install (what Vercel uses)
│   ├── requirements-full.txt       + torch re-ranker & server OCR (local / Docker)
│   ├── routes/ · voice/ · cli/ · scripts/ · data/ · vector_db/
│   └── tests/                      48 automated tests (incl. real OCR)
│
├── docs/DEPLOY_VERCEL.md      ← ⭐ step-by-step guide to go live on Vercel
├── docs/SECURITY.md           ← every security control + accepted risks
├── vercel.json                ← Vercel config: 3 services (web, api, ai)
├── docker-compose.yml         ← alternative: self-hosted deployment
└── .github/workflows/ci.yml   ← tests + audits on every push
```

---

## 🚀 Run it locally (Windows)

**Needs:** Node.js 20+, Python 3.11+, MongoDB running locally.
**Optional:** [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) (`winget install UB-Mannheim.TesseractOCR`) – without it, the built-in RapidOCR fallback is used.

### 1 · AI service (terminal 1)
```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt          # light install (fast)
pip install -r requirements-full.txt     # optional: best search quality + server OCR (large: torch)
copy .env.example .env                   # add GROQ_API_KEY and AI_SERVICE_KEY
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 2 · Server (terminal 2)
```powershell
cd server
npm install
npm run gen-secrets                      # prints strong secrets
copy .env.example .env                   # paste the secrets; AI_SERVICE_KEY must match step 1
npm run dev
```

### 3 · Client (terminal 3)
```powershell
cd client
npm install
npm run dev                              # http://localhost:5173
```

**Single-server mode** (demo / production): `cd client && npm run build`, then the server at
<http://localhost:5000> serves the website too.

> 💡 For a quick demo: register, open the **Dashboard** and click **"Load 3 demo reports"** to see trends and insights instantly.

---

## 🧪 Tests & audits

```powershell
cd server;      npm test                 # 50 tests: auth, sessions, CSRF, encryption, access control, uploads, history, chat, serverless
cd ai-service;  python -m pytest -q      # 48 tests: parser, printed ranges, OCR, lite vector search, file security, API
cd server;      npm audit                # 0 vulnerabilities
cd client;      npm audit                # 0 vulnerabilities
```

---

## ☁️ Deploy on Vercel (recommended)

Follow **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)**: a beginner-friendly, step-by-step guide
(GitHub → MongoDB Atlas → Vercel, about 30 minutes, all free tiers).

## 🐳 Alternative: deploy with Docker

```bash
cp .env.docker.example .env      # fill in secrets
docker compose up -d --build     # web on :5000 - put HTTPS (nginx/Caddy) in front
```
Only the web container is reachable; MongoDB and the AI service run on an internal network.

---

## 🔑 Configuration

| File | Key settings |
|---|---|
| `server/.env` | `MONGODB_URI`, `JWT_ACCESS_SECRET`, `DATA_ENCRYPTION_KEY` (**back it up!**), `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `CLIENT_ORIGINS` |
| `ai-service/.env` | `AI_SERVICE_KEY` (same as server), `GROQ_API_KEY` (optional), `GROQ_MODEL`, `USE_RAG`, `TESSERACT_CMD`, `APP_ENV` |

Without `GROQ_API_KEY` everything still works in **offline mode** (rule-based summaries, dataset answers).
If Groq reports `model_not_found`, pick a current model at <https://console.groq.com/docs/models> and set `GROQ_MODEL`.

---

## 🧠 How the AI parts work

**Report analysis:** in the browser the file type is checked by its bytes → digital PDF text (pdf.js) *or*
page images → canvas clean-up (grayscale, upscale, shadow removal, Otsu-guided contrast) → tesseract.js OCR →
only the text goes to the server → regex finds 23 tests + the lab's own reference range → OCR sanity check → normal / borderline / abnormal → health score → concerns (e.g. glucose + HbA1c → Prediabetes)
→ Ayurvedic profile → AI or rule-based summary.

**Veda Assistant (RAG):** emergency check → hybrid search (BM25 + vectors) over the symptom DB → re-rank
(full mode) or Reciprocal Rank Fusion (lite mode, Vercel) →
LLM picks the condition → search the Ayurveda book → LLM answers using only retrieved text **+ your latest report findings**.

**Insights:** for each parameter, "distance outside the normal range" is compared between reports
→ improved / back to normal / worsened / rising-or-falling pattern.
