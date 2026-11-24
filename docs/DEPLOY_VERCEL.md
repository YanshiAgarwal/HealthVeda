# 🚀 Deploy HealthVeda on Vercel – step by step

Everything (website + API + AI service) runs in **one Vercel project**.
The database is **MongoDB Atlas** (free), because Vercel cannot host databases.

```
             https://healthveda.vercel.app
                         │
          ┌──────────────┼───────────────────────────┐
          │  /           │  /api/*                    │   (private, no public URL)
     ┌────▼────┐   ┌─────▼──────────┐  X-Service-Key  ┌──────────────┐
     │  web    │   │  api (Node)    │ ───────────────► │  ai (Python) │──► Groq
     │ React   │   │  Express       │                  │  FastAPI     │
     └─────────┘   └─────┬──────────┘                  └──────────────┘
                         │ TLS
                   MongoDB Atlas (free M0)
```

⏱️ Time needed: about **30 minutes** the first time. Cost: **₹0** (all free tiers).

---

## ✅ Before you start

You need free accounts on:

| Service | Sign-up link | Used for |
|---|---|---|
| GitHub | https://github.com/signup | Stores your code; Vercel deploys from it |
| Vercel | https://vercel.com/signup (choose **Continue with GitHub**) | Hosting |
| MongoDB Atlas | https://www.mongodb.com/cloud/atlas/register | Database |
| Groq *(optional)* | https://console.groq.com/keys | AI answers & summaries |

And on your computer: **Git** and **Node.js 20+** (check with `git --version` and `node --version`).

---

## Step 1 – Put the code on GitHub

Open **PowerShell** and run:

```powershell
cd C:\Projects\HealthVeda
git init -b main
git add .
git status
```

🔍 **Check the list `git status` prints.** You must **NOT** see any file called `.env`
(only `.env.example` files are allowed). The `.gitignore` already hides them – this is just a safety check.

```powershell
git commit -m "HealthVeda - first release"
```

Now on GitHub:
1. Click **+** (top right) → **New repository**.
2. Name: `healthveda` · choose **Private** · do **not** tick "Add a README".
3. Click **Create repository**, then copy the two commands shown under
   *"…or push an existing repository from the command line"*. They look like:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/healthveda.git
git push -u origin main
```

Refresh the GitHub page – your code is there. ✅

---

## Step 2 – Create the database (MongoDB Atlas)

1. Log in to https://cloud.mongodb.com → **Create** a cluster.
2. Choose **M0 (Free)** · Provider **AWS** · Region **Mumbai (ap-south-1)** (closest to India) · Name `healthveda` → **Create Deployment**.
3. A box asks you to **create a database user**:
   - Username: `healthveda_app`
   - Click **Autogenerate Secure Password** → **Copy** it and save it somewhere safe (e.g. Notepad for now).
   - Click **Create Database User**.
4. Left menu → **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) → **Confirm**.
   > Why? Vercel's servers don't have fixed IP addresses. Your data stays protected by the
   > strong password, encrypted connections (TLS) and HealthVeda's own AES-256 encryption.
5. Left menu → **Database** → **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://healthveda_app:<db_password>@healthveda.ab12cd.mongodb.net/?retryWrites=true&w=majority&appName=healthveda
   ```
6. Edit it in Notepad:
   - replace `<db_password>` with the password from step 3,
   - add the database name **`healthveda`** right after `.net/`:
   ```
   mongodb+srv://healthveda_app:YourPassw0rd@healthveda.ab12cd.mongodb.net/healthveda?retryWrites=true&w=majority&appName=healthveda
   ```
   This full line is your **`MONGODB_URI`**.

---

## Step 3 – Create production secrets

Use **new** secrets for production (never reuse your local ones):

```powershell
cd C:\Projects\HealthVeda\server
npm install
npm run gen-secrets
```

It prints three lines – copy them to Notepad:

```
JWT_ACCESS_SECRET=...
DATA_ENCRYPTION_KEY=...
AI_SERVICE_KEY=...
```

⚠️ **Back up `DATA_ENCRYPTION_KEY`** (e.g. in a password manager). If you lose it, saved reports can never be decrypted.

*(Optional)* Groq: https://console.groq.com/keys → **Create API Key** → copy it. This is your **`GROQ_API_KEY`**.
Without it HealthVeda still works in "offline" mode (rule-based summaries).

---

## Step 4 – Deploy on Vercel

1. Go to https://vercel.com/new.
2. Under **Import Git Repository**, find `healthveda` → **Import**.
   (First time: click **Adjust GitHub App Permissions** and allow access to the repository.)
3. On the configure screen:
   - **Project Name:** `healthveda` (this becomes `healthveda.vercel.app` – pick another name if taken)
   - **Root Directory:** leave as `./`
   - **Framework / Build settings:** leave them alone – the `vercel.json` file in the project
     tells Vercel to build 3 services (`web`, `api`, `ai`).
4. Open **Environment Variables** and add these (Name → Value), one by one:

   | Name | Value |
   |---|---|
   | `MONGODB_URI` | your full connection string from Step 2 |
   | `JWT_ACCESS_SECRET` | from Step 3 |
   | `DATA_ENCRYPTION_KEY` | from Step 3 |
   | `AI_SERVICE_KEY` | from Step 3 |
   | `GROQ_API_KEY` | from Step 3 *(optional)* |

   Everything else is configured automatically when running on Vercel.
5. Click **Deploy** and wait 3–6 minutes. ☕
6. When you see 🎉 **Congratulations**, click **Continue to Dashboard** → **Visit**.

---

## Step 5 – Check that everything works

1. Open `https://YOUR-PROJECT.vercel.app/api/health` → should show `{"status":"ok"}`.
2. Open `https://YOUR-PROJECT.vercel.app/api/status` → `"server":"ok"` and `"ai":{"online":true,...}`.
3. Open the website → **Log in → Create an account**.
4. **Dashboard → Load 3 demo reports** → trends and insights appear.
5. **Report Analyzer** → upload a PDF or a photo of a report.
6. **Veda Assistant** → ask *"I have a dry cough"*.
   > The **first** chat after a deployment can take 20–40 seconds (the AI downloads its small
   > embedding model once). After that, answers take a few seconds.

🎉 **HealthVeda is live.**

---

## Updating the site later

Every time you push to GitHub, Vercel redeploys automatically:

```powershell
cd C:\Projects\HealthVeda
git add .
git commit -m "Describe your change"
git push
```

To change a secret: Vercel → your project → **Settings → Environment Variables** → edit →
then **Deployments → ⋯ → Redeploy**.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| Build error mentioning **`services`** in `vercel.json` | Vercel Services is in **beta**. Check https://vercel.com/docs/services. If it isn't enabled for your account, use **Plan B** below. |
| `/api/status` says `"ai":{"online":false}` | `AI_SERVICE_KEY` missing, or the AI service failed to start. Vercel → project → **Logs** → filter by the `ai` service. |
| Website says *"Something went wrong"* on every request | Vercel → **Logs** for the `api` service. `Invalid server configuration` = an environment variable is missing or too short. |
| `MongoServerSelectionError` in logs | Atlas **Network Access** must allow `0.0.0.0/0`; check the password and that `/healthveda` is in `MONGODB_URI`. Special characters in the password must be URL-encoded (easiest: use Atlas' autogenerated password). |
| Logged out immediately after logging in | Always use the `https://` address (login cookies are HTTPS-only). |
| "Too many requests" | Rate limiting is working 🙂 – wait 15 minutes. |
| First chat is slow | Normal – one-time model download per server instance. |
| AI says `model_not_found` | Groq retired the model. Add env var `GROQ_MODEL` with a current model from https://console.groq.com/docs/models and redeploy. |

---

## Plan B – without Vercel Services (3 separate projects)

Only if Step 4 fails because Services isn't available. Import the **same GitHub repo three times**:

**Project `healthveda-ai`** – Root Directory: `ai-service` · Framework: **FastAPI**
Env vars: `AI_SERVICE_KEY`, `GROQ_API_KEY`. Note its URL, e.g. `https://healthveda-ai.vercel.app`.

**Project `healthveda-api`** – Root Directory: `server` · Framework: **Express**
Env vars: everything from Step 4, plus
`AI_SERVICE_URL` = the AI project's URL, and `CLIENT_ORIGINS` = `https://healthveda-web.vercel.app`.

**Project `healthveda-web`** – Root Directory: `client` · Framework: **Vite**.
Before importing it, create the file `client/vercel.json` (and push it):
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://healthveda-api.vercel.app/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
The website forwards `/api` calls to the API project, so login cookies still work on one domain.
(In Plan B the AI service has a public URL, but it rejects every request without `AI_SERVICE_KEY`.)

---

## What runs differently on Vercel (and why)

| Feature | Local / Docker | Vercel |
|---|---|---|
| Report reading (PDF / OCR) | in the browser | in the browser (the file never leaves the device) |
| Chatbot search | "full": Chroma + torch re-ranker | "lite": same embeddings via ONNX + BM25 + rank fusion (torch is too big for serverless) |
| Rate-limit counters | memory | MongoDB (shared by all serverless instances) |
| Database | local MongoDB | MongoDB Atlas |

The AI service picks its mode automatically (`SEARCH_MODE=auto`).
