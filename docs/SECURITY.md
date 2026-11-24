# HealthVeda – Security Design

HealthVeda stores **medical data**, so security is built into every layer.
Each control below is covered by an automated test (`server/tests`, `ai-service/tests`).

## Architecture & trust boundaries

On Vercel the three parts are deployed as **Services** of one project: only `web` and `api` are routed
publicly; `ai` is reachable only through a private service binding (and still requires the service key).

```
 Browser ──HTTPS──► Node.js server (Express) ──► MongoDB          (internal network only)
                          │
                          └── X-Service-Key ──► Python AI service  (internal network only)
                                                    └──► Groq LLM API (outbound only)
```

- The browser only ever talks to the **Node server**.
- The **AI service** rejects any request without the shared `X-Service-Key`
  (constant-time comparison) and has no public port in Docker.
- **MongoDB** sits on an internal Docker network with authentication on.

## Controls

| Area | Control | Where |
|---|---|---|
| **Passwords** | scrypt (N=2¹⁷, r=8, p=1 – OWASP), random 16-byte salt, parameters stored for future upgrades, automatic re-hash | `server/src/services/crypto.js` |
| | Policy: 8–128 chars, letter + number, common-password list, must not contain name/email (NIST 800-63B) | `utils/passwordPolicy.js` |
| **Login** | Same error + same timing for wrong email and wrong password (no user enumeration) | `authController.js` |
| | Account lock: 5 failures → 15 min lock; IP rate limit 10 failed attempts / 15 min | `authController.js`, `rateLimits.js` |
| **Sessions** | Access token: 15-min JWT (HS256, pinned algorithm, issuer + audience checked) in an **httpOnly, Secure, SameSite=Strict** cookie | `services/session.js` |
| | Refresh token: random 48 bytes, only its SHA-256 hash stored, path-scoped to `/api/auth`, **rotated on every use**, **reuse detection** revokes the whole login family | `services/session.js` |
| | "Log out everywhere" and password change invalidate all existing tokens (`tokenVersion`) | `userController.js` |
| **CSRF** | SameSite=Strict cookies **plus** Origin check on every state-changing request | `middleware/security.js` |
| **Data at rest** | Every report (values, summary, patient name, file name, OCR text) is encrypted with **AES-256-GCM**, random IV per record, **AAD = owner's user id** (a record copied into another account can't be decrypted), key id stored for **key rotation** | `services/crypto.js`, `reportStore.js` |
| | The website reads reports **in the browser** (pdf.js + tesseract.js): the original file **never leaves the user's device**; only extracted text is sent | `client/src/ocr/` |
| | Server-side upload API (local/Docker): files processed in memory only, never stored | `middleware/upload.js` |
| | pdf.js pinned to a version **patched against malicious-PDF code execution** (GHSA-hq66-cqwq-w95j) | `client/package.json` |
| **Data quality** | OCR sanity check: values more than 5x outside plausible limits are flagged "please double-check" (e.g. a lost decimal point), never silently changed | `report_analyzer.py` |
| **Access control** | Every report query filters by `_id` **and** owner; other users get 404 (no existence leak) | `reportStore.js` |
| **Input validation** | Strict zod schemas on every body/query/param – unknown fields rejected (no mass assignment) | `middleware/validate.js` |
| | NoSQL injection: `mongoose.sanitizeFilter` + schema validation; `query parser = simple` | `config/db.js`, `app.js` |
| **File uploads** | 10 MB limit, 1 file, MIME allow-list **and** magic-byte sniffing (a renamed `.exe` is rejected), encrypted/oversized PDFs and decompression-bomb images refused, page limits for OCR | `upload.js`, `document_reader.py` |
| **HTTP hardening** | Helmet: strict CSP (`script-src 'self'`), `frame-ancestors 'none'`, HSTS (prod), nosniff, Permissions-Policy; `x-powered-by` off; `Cache-Control: no-store` on all API responses; 100 kb JSON limit | `app.js` |
| **Abuse limits** | Global 300 req / 15 min / IP; uploads 30 / hour / user; chat 20 / min / user. On Vercel the counters live in **MongoDB** (shared across serverless instances, TTL-cleaned) | `rateLimits.js`, `mongoRateStore.js` |
| **Errors & logs** | Internal errors never reach the client (generic message + request id); logs are structured JSON with cookies, keys, passwords and report text **redacted** | `errorHandler.js`, `utils/logger.js` |
| **Audit trail** | Logins, failures, lockouts, token theft, report create/view/edit/delete, export, deletion – kept 1 year (TTL index), no medical data inside; users can see their own activity | `models/AuditLog.js` |
| **Privacy rights** | Export all my data (JSON); delete account + all reports (password + "DELETE" confirmation) | `userController.js` |
| **Config safety** | Server refuses to start with missing/weak secrets; AI docs (`/docs`) disabled in production | `config/env.js`, `ai-service/main.py` |
| **Supply chain** | `npm audit` = 0 vulnerabilities (server + client); `pip-audit` in CI | `.github/workflows/ci.yml` |
| **Containers** | Non-root users, read-only filesystem for the web container, `no-new-privileges` | `Dockerfile`s, `docker-compose.yml` |

## Accepted risks (reviewed)

| Item | Why it is acceptable |
|---|---|
| `chromadb` advisories PYSEC-2026-311 / 3813 / 3814 / 3815 (no fixed version yet) | Only in the optional **full** install (local/Docker). They affect Chroma's **HTTP server mode**; HealthVeda uses Chroma **embedded**, so the vulnerable code is unreachable. **Not installed on Vercel** (`requirements.txt` has 0 known vulnerabilities). |
| `'wasm-unsafe-eval'` in the CSP | Needed for in-browser OCR (WebAssembly). It allows compiling WebAssembly only, **not** JavaScript `eval()`. All scripts and WASM files are self-hosted (`script-src 'self'`). |
| MongoDB Atlas allows `0.0.0.0/0` on Vercel | Vercel has no fixed IPs. Mitigated by a strong generated DB password, TLS, a least-privilege DB user and AES-256 encryption of reports. |
| Registration reveals if an email is already registered | Trade-off for usability. Full protection needs email verification (future work). |
| Health data is sent to the Groq LLM API for summaries/chat | Only lab values + short findings are sent (no name/email). Leave `GROQ_API_KEY` empty to keep everything local (rule-based mode). |

## Operations

- **Back up `DATA_ENCRYPTION_KEY`** separately from database backups. Without it, reports can't be decrypted.
- **Key rotation:** generate a new key, set it as `DATA_ENCRYPTION_KEY` with a new `DATA_ENCRYPTION_KEY_ID` (e.g. `k2`), and move the old one to `DATA_ENCRYPTION_OLD_KEYS=k1:<old base64>`. Reports are re-encrypted with the new key automatically when opened.
- Always run behind **HTTPS** in production (cookies are `Secure`).
- Set `TRUST_PROXY=1` when behind exactly one reverse proxy so rate limits see real client IPs.
