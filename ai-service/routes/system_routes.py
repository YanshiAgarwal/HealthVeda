"""Service status (used by the Node server's health checks)."""

from fastapi import APIRouter

from config import APP_NAME, APP_VERSION
from services.ayurveda_rag import assistant
from services.document_reader import available_ocr_engine
from services.llm_service import is_llm_available

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/status")
def status():
    return {
        "app": APP_NAME,
        "version": APP_VERSION,
        "ai_enabled": is_llm_available(),          # GROQ_API_KEY present?
        "search_mode": assistant.mode,             # "full", "lite", "keyword" or "not_loaded"
        "ocr_engine": available_ocr_engine(),      # "tesseract", "rapidocr" or None
    }
