"""
config.py
---------
ONE place for every setting in HealthVeda.

All other files import from here, e.g.  `from config import GROQ_API_KEY`.
Secret keys are read from the `.env` file in this folder (see .env.example).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# ── Folders ──────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent      # .../HealthVeda/backend
DATA_DIR = BACKEND_DIR / "data"
VECTOR_DB_DIR = BACKEND_DIR / "vector_db"

# Load secrets from backend/.env (works no matter which folder you run from)
load_dotenv(BACKEND_DIR / ".env")

# ── App info ─────────────────────────────────────────────────────────────
APP_NAME = "HealthVeda"
APP_VERSION = "1.0.0"
APP_TAGLINE = "Ancient Ayurvedic wisdom meets modern AI health analysis"

# ── Data files ───────────────────────────────────────────────────────────
RAW_DATASET = DATA_DIR / "ayurveda_dataset.csv"    # original dataset (34 columns)
CLEAN_DATASET = DATA_DIR / "ayurveda_clean.csv"    # cleaned dataset (13 columns)
BOOK_PDF = DATA_DIR / "Ayurveda.pdf"               # only needed to rebuild book_db

SYMPTOM_DB_DIR = VECTOR_DB_DIR / "symptom_db"      # Chroma DB built from the CSV
BOOK_DB_DIR = VECTOR_DB_DIR / "book_db"            # Chroma DB built from the book
VECTOR_INDEX_DIR = BACKEND_DIR / "vector_index"    # light export of both (for serverless)

IS_SERVERLESS = bool(os.getenv("VERCEL"))          # Vercel sets VERCEL=1

# ── AI models ────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
# Groq retires models from time to time. If you see "model_not_found",
# pick a current one from https://console.groq.com/docs/models and set GROQ_MODEL.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"         # turns text into vectors
RERANKER_MODEL = "BAAI/bge-reranker-base"          # re-orders search results

# How the chatbot searches the Ayurveda knowledge (SEARCH_MODE in .env):
#   auto    - best available: full -> lite -> keyword   (default)
#   full    - Chroma + BM25 + BGE re-ranker (needs torch; local / Docker)
#   lite    - exported NumPy index + ONNX embeddings + BM25 (serverless / Vercel)
#   keyword - simple word matching over the CSV (no ML at all)
# (Old setting USE_RAG=false still works and means "keyword".)
SEARCH_MODE = os.getenv("SEARCH_MODE", "auto").lower()
if os.getenv("USE_RAG", "true").lower() == "false":
    SEARCH_MODE = "keyword"
USE_RAG = SEARCH_MODE != "keyword"

# Where the light ONNX embedding model is cached (/tmp is the only writable dir on Vercel)
FASTEMBED_CACHE = os.getenv("FASTEMBED_CACHE") or (
    "/tmp/fastembed" if IS_SERVERLESS else str(BACKEND_DIR / ".cache" / "fastembed"))

# ── Voice (Sarvam AI) & phone calls (Twilio) - optional ──────────────────
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
DOMAIN = os.getenv("DOMAIN", "").strip()           # public tunnel, no https://

# ── Service security ─────────────────────────────────────────────────────
# This AI service is INTERNAL: only the Node.js server may call it.
# Every request must send the header  X-Service-Key: <AI_SERVICE_KEY>
# (the same value must be in server/.env). Generate one with:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "").strip()
APP_ENV = os.getenv("APP_ENV", "production" if IS_SERVERLESS else "development")  # production hides /docs

MAX_UPLOAD_MB = 10

# ── OCR (reading scanned reports / photos) ───────────────────────────────
# Windows default install path of Tesseract; change it if you installed elsewhere.
TESSERACT_CMD = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
OCR_LANGUAGES = os.getenv("OCR_LANGUAGES", "eng")
