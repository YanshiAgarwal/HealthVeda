"""
document_reader.py
------------------
Turns ANY uploaded lab report into plain text:

    digital PDF ──────────────► pypdf text extraction
    scanned PDF ──► render pages (pypdfium2, 300 DPI) ─┐
    photo / scan (PNG/JPG/WEBP) ───────────────────────┴─► OpenCV clean-up ─► OCR
    .txt ─────────────────────► decoded directly

OCR engines (first one available is used):
    1. Tesseract (pytesseract) - needs the Tesseract program installed
    2. RapidOCR  (pip install rapidocr onnxruntime) - pure pip fallback

Computer-vision clean-up (why each step helps OCR):
    grayscale         colour adds noise, OCR only needs brightness
    upscale           OCR is most accurate when text is ~30 px tall
    light correction  removes shadows / uneven phone-camera lighting
    deskew            straightens slightly rotated photos
    Otsu threshold    turns the page into crisp black text on white
"""

import io
import logging
import shutil
from dataclasses import dataclass, field

import numpy as np

from config import OCR_LANGUAGES, TESSERACT_CMD

logger = logging.getLogger(__name__)

MAX_PDF_PAGES = 30          # refuse giant PDFs (protects memory/CPU)
MAX_OCR_PAGES = 10          # OCR is slow - only the first 10 pages
MAX_IMAGE_PIXELS = 40_000_000  # ~40 MP: blocks "decompression bomb" images
MIN_TEXT_PER_PAGE = 40      # less text than this = probably a scanned page


class DocumentError(ValueError):
    """A problem the user can fix (wrong file type, unreadable file...)."""


@dataclass
class ExtractedDocument:
    text: str
    method: str                       # "pdf-text" | "ocr" | "text"
    pages: int = 1
    ocr_engine: str | None = None
    ocr_confidence: float | None = None   # 0-100, average word confidence
    warnings: list[str] = field(default_factory=list)


# ── 1. What kind of file is it? (check the bytes, never trust the name) ─
def detect_file_type(data: bytes) -> str:
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff"):
        return "image"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image"
    try:
        sample = data[:4096].decode("utf-8")
        if "\x00" not in sample:
            return "text"
    except UnicodeDecodeError:
        pass
    return "unknown"


# ── 2. Image clean-up with OpenCV ────────────────────────────────────────
def preprocess_for_ocr(image: np.ndarray) -> np.ndarray:
    """Return a clean, straight, black-on-white version of the page."""
    import cv2

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image

    # Upscale small images so letters are big enough for OCR
    height, width = gray.shape
    if width < 1600:
        scale = 1600 / width
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Remove shadows: divide by a blurred "background" estimate
    background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    normalized = cv2.divide(gray, background, scale=255)

    # Straighten (deskew) using the angle of the text block
    binary_inv = cv2.threshold(normalized, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(binary_inv > 0))
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords.astype(np.float32))[-1]
        angle = angle - 90 if angle > 45 else angle
        if 0.5 < abs(angle) < 15:
            h, w = normalized.shape
            matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
            normalized = cv2.warpAffine(normalized, matrix, (w, h),
                                        flags=cv2.INTER_CUBIC, borderValue=255)

    # Final crisp black text on white background
    return cv2.threshold(normalized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]


# ── 3. OCR engines ───────────────────────────────────────────────────────
def _tesseract_ready() -> bool:
    try:
        import pytesseract
    except ImportError:
        return False
    if TESSERACT_CMD and shutil.which(TESSERACT_CMD):
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
        return True
    return shutil.which("tesseract") is not None


def _ocr_tesseract(clean: np.ndarray) -> tuple[str, float]:
    import pytesseract

    # psm 6 = "a single uniform block of text" - works well for lab tables
    config = "--oem 3 --psm 6"
    text = pytesseract.image_to_string(clean, lang=OCR_LANGUAGES, config=config)
    data = pytesseract.image_to_data(clean, lang=OCR_LANGUAGES, config=config,
                                     output_type=pytesseract.Output.DICT)
    confidences = [float(c) for c in data["conf"] if float(c) >= 0]
    return text, (sum(confidences) / len(confidences) if confidences else 0.0)


_rapid_engine = None


def _rapidocr_ready() -> bool:
    try:
        import rapidocr  # noqa: F401
        return True
    except ImportError:
        return False


def _ocr_rapid(image: np.ndarray) -> tuple[str, float]:
    """RapidOCR returns boxes + text pieces; we rebuild them into lines."""
    global _rapid_engine
    from rapidocr import RapidOCR

    if _rapid_engine is None:
        _rapid_engine = RapidOCR()
    result = _rapid_engine(image)
    boxes, texts, scores = result.boxes, result.txts, result.scores
    if boxes is None or not texts:
        return "", 0.0

    # Group words that sit on the same horizontal line, then read left-to-right
    pieces = []
    for box, text in zip(boxes, texts):
        ys, xs = [p[1] for p in box], [p[0] for p in box]
        pieces.append({"y": sum(ys) / 4, "x": min(xs), "h": max(ys) - min(ys), "text": text})
    pieces.sort(key=lambda p: p["y"])
    lines, current = [], [pieces[0]]
    for piece in pieces[1:]:
        if abs(piece["y"] - current[-1]["y"]) < max(piece["h"], current[-1]["h"]) * 0.6:
            current.append(piece)
        else:
            lines.append(current)
            current = [piece]
    lines.append(current)
    text = "\n".join("  ".join(p["text"] for p in sorted(line, key=lambda p: p["x"])) for line in lines)
    return text, 100 * sum(scores) / len(scores)


def available_ocr_engine() -> str | None:
    if _tesseract_ready():
        return "tesseract"
    if _rapidocr_ready():
        return "rapidocr"
    return None


def ocr_image(image: np.ndarray) -> tuple[str, float, str]:
    """OCR one page image. Returns (text, confidence 0-100, engine name)."""
    engine = available_ocr_engine()
    if engine is None:
        raise DocumentError(
            "This looks like a scanned report or photo, but no OCR engine is installed "
            "on the server. Install Tesseract OCR (see README) or upload a digital PDF.")
    if engine == "tesseract":
        text, conf = _ocr_tesseract(preprocess_for_ocr(image))
    else:
        import cv2
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
        text, conf = _ocr_rapid(gray)   # RapidOCR has its own detector; gray is enough
    return text, conf, engine


# ── 4. Loading images / PDF pages ────────────────────────────────────────
def _load_image(data: bytes) -> np.ndarray:
    from PIL import Image, ImageOps

    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)        # respect phone rotation
            return np.array(img.convert("RGB"))[:, :, ::-1].copy()  # RGB -> BGR
    except Image.DecompressionBombError:
        raise DocumentError("Image is too large. Please upload a smaller photo.")
    except Exception:
        raise DocumentError("Could not open this image. Is the file damaged?")


def _render_pdf_pages(data: bytes, max_pages: int) -> list[np.ndarray]:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(data)
    try:
        images = []
        for index in range(min(len(pdf), max_pages)):
            bitmap = pdf[index].render(scale=300 / 72)   # 300 DPI
            images.append(np.array(bitmap.to_pil().convert("RGB"))[:, :, ::-1].copy())
        return images
    finally:
        pdf.close()


def _ocr_pages(images: list[np.ndarray]) -> tuple[str, float, str]:
    texts, confidences, engine = [], [], None
    for image in images:
        text, conf, engine = ocr_image(image)
        texts.append(text)
        confidences.append(conf)
    return "\n".join(texts), sum(confidences) / max(len(confidences), 1), engine


# ── Main entry point ─────────────────────────────────────────────────────
def read_document(data: bytes) -> ExtractedDocument:
    kind = detect_file_type(data)

    if kind == "text":
        return ExtractedDocument(text=data.decode("utf-8", errors="ignore"), method="text")

    if kind == "image":
        text, conf, engine = ocr_image(_load_image(data))
        doc = ExtractedDocument(text=text, method="ocr", ocr_engine=engine,
                                ocr_confidence=round(conf, 1))
        if conf < 60:
            doc.warnings.append("The photo was hard to read. Check the values, or retake "
                                "the photo flat, in good light and without shadows.")
        return doc

    if kind == "pdf":
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise DocumentError("This PDF is password-protected. Please upload an unlocked copy.")
            pages = len(reader.pages)
            if pages > MAX_PDF_PAGES:
                raise DocumentError(f"PDF has {pages} pages; the limit is {MAX_PDF_PAGES}.")
            text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except DocumentError:
            raise
        except Exception:
            raise DocumentError("Could not read this PDF. Is the file damaged?")

        if len(text) >= MIN_TEXT_PER_PAGE * pages:
            return ExtractedDocument(text=text, method="pdf-text", pages=pages)

        # Little or no text -> it's a scanned PDF -> OCR each page image
        ocr_text, conf, engine = _ocr_pages(_render_pdf_pages(data, MAX_OCR_PAGES))
        doc = ExtractedDocument(text=ocr_text, method="ocr", pages=pages, ocr_engine=engine,
                                ocr_confidence=round(conf, 1))
        if pages > MAX_OCR_PAGES:
            doc.warnings.append(f"Only the first {MAX_OCR_PAGES} pages were scanned.")
        return doc

    raise DocumentError("Unsupported file. Please upload a PDF, PNG, JPG, WEBP or TXT report.")
