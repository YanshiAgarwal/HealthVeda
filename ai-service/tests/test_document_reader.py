"""OCR + file handling tests. Images are generated on the fly with OpenCV."""

import io

import numpy as np
import pytest

# Server-side OCR is part of the FULL install only (requirements-full.txt)
cv2 = pytest.importorskip("cv2")
Image = pytest.importorskip("PIL.Image")

from services.document_reader import (  # noqa: E402
    DocumentError, available_ocr_engine, detect_file_type, preprocess_for_ocr, read_document,
)
from services.report_analyzer import find_lab_values

needs_ocr = pytest.mark.skipif(available_ocr_engine() is None, reason="no OCR engine installed")

LINES = ["LAB REPORT", "Hemoglobin 11.2 g/dL", "Fasting Glucose 118 mg/dL", "TSH 2.8 mIU/L"]


def make_report_image(rotate_deg: float = 0, shadow: bool = False) -> np.ndarray:
    img = np.full((520, 1400, 3), 255, np.uint8)
    for i, line in enumerate(LINES):
        cv2.putText(img, line, (60, 100 + i * 110), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (20, 20, 20), 3)
    if shadow:   # simulate uneven phone-camera lighting
        gradient = np.tile(np.linspace(1.0, 0.55, img.shape[1]), (img.shape[0], 1))
        img = (img * gradient[..., None]).astype(np.uint8)
    if rotate_deg:
        h, w = img.shape[:2]
        m = cv2.getRotationMatrix2D((w / 2, h / 2), rotate_deg, 1.0)
        img = cv2.warpAffine(img, m, (w, h), borderValue=(255, 255, 255))
    return img


def to_bytes(img: np.ndarray, fmt: str) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(img[:, :, ::-1]).save(buffer, format=fmt)
    return buffer.getvalue()


# ── File type detection (magic bytes, not file names) ───────────────────
def test_detect_file_types():
    assert detect_file_type(b"%PDF-1.7 ...") == "pdf"
    assert detect_file_type(to_bytes(make_report_image(), "PNG")) == "image"
    assert detect_file_type(to_bytes(make_report_image(), "JPEG")) == "image"
    assert detect_file_type("Hemoglobin 13 g/dL".encode()) == "text"
    assert detect_file_type(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00") == "unknown"   # a .exe


def test_rejects_executable_disguised_as_report():
    with pytest.raises(DocumentError):
        read_document(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\xff\xff\x00\x00")


def test_rejects_corrupt_pdf():
    with pytest.raises(DocumentError):
        read_document(b"%PDF-1.4 this is not really a pdf")


def test_rejects_password_protected_pdf():
    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.encrypt("secret")
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(DocumentError, match="password"):
        read_document(buffer.getvalue())


def test_plain_text_report():
    doc = read_document(b"Hemoglobin 13.5 g/dL")
    assert doc.method == "text" and "13.5" in doc.text


# ── Computer-vision preprocessing ───────────────────────────────────────
def test_preprocess_outputs_clean_binary_image():
    clean = preprocess_for_ocr(make_report_image(rotate_deg=4, shadow=True))
    assert clean.ndim == 2                                   # grayscale
    assert set(np.unique(clean)) <= {0, 255}                 # pure black/white
    assert clean.shape[1] >= 1400                            # not shrunk
    # mostly white background even though the input had a dark shadow
    assert (clean == 255).mean() > 0.85


# ── Real OCR ─────────────────────────────────────────────────────────────
@needs_ocr
@pytest.mark.parametrize("fmt", ["PNG", "JPEG"])
def test_ocr_photo_report(fmt):
    doc = read_document(to_bytes(make_report_image(), fmt))
    assert doc.method == "ocr"
    values = {t["key"]: t["value"] for t in find_lab_values(doc.text)}
    assert values.get("hemoglobin") == 11.2
    assert values.get("glucose") == 118


@needs_ocr
def test_ocr_tilted_shadowed_photo():
    doc = read_document(to_bytes(make_report_image(rotate_deg=3, shadow=True), "PNG"))
    values = {t["key"]: t["value"] for t in find_lab_values(doc.text)}
    assert values.get("glucose") == 118


@needs_ocr
def test_scanned_pdf_uses_ocr():
    pdf = io.BytesIO()
    Image.fromarray(make_report_image()[:, :, ::-1]).save(pdf, format="PDF", resolution=150)
    doc = read_document(pdf.getvalue())
    assert doc.method == "ocr" and doc.ocr_engine is not None
    values = {t["key"]: t["value"] for t in find_lab_values(doc.text)}
    assert values.get("hemoglobin") == 11.2
