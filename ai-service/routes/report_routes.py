"""Report Analyzer - PDF, scanned PDF, photo or text in -> explained results out."""

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from config import MAX_UPLOAD_MB
from services.document_reader import DocumentError, read_document
from services.report_analyzer import SAMPLE_REPORT, analyze_report_text

router = APIRouter(prefix="/api/reports", tags=["Report Analyzer"])

MAX_TEXT_FOR_STORAGE = 20_000   # characters of extracted text returned to the server


class TextReport(BaseModel):
    text: str = Field(..., min_length=10, max_length=50_000)


def _analysis(text: str, extraction: dict) -> dict:
    result = analyze_report_text(text)
    result["extraction"] = extraction
    result["extracted_text"] = text[:MAX_TEXT_FOR_STORAGE]
    return result


@router.post("/analyze")
def analyze_file(file: UploadFile = File(...)):
    """Accepts PDF (digital or scanned), PNG, JPG, WEBP or TXT."""
    content = file.file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File is too large (max {MAX_UPLOAD_MB} MB).")
    if not content:
        raise HTTPException(400, "The file is empty.")

    try:
        document = read_document(content)
    except DocumentError as error:
        raise HTTPException(400, str(error))

    if len(document.text.strip()) < 10:
        raise HTTPException(400, "No readable text was found in this file.")

    return _analysis(document.text, {
        "method": document.method,
        "pages": document.pages,
        "ocr_engine": document.ocr_engine,
        "ocr_confidence": document.ocr_confidence,
        "warnings": document.warnings,
    })


@router.post("/analyze-text")
def analyze_text(report: TextReport):
    return _analysis(report.text, {"method": "text", "pages": 1, "warnings": []})


@router.get("/sample")
def sample_report():
    return _analysis(SAMPLE_REPORT.strip(), {"method": "sample", "pages": 1, "warnings": []})
