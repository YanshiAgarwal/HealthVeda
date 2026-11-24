# HealthVeda AI service (Python). Internal only - never expose its port publicly.
FROM python:3.12-slim

# Tesseract OCR (+ Hindi language data) and libraries OpenCV needs
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    TESSERACT_CMD=/usr/bin/tesseract HF_HOME=/app/.cache/huggingface

COPY requirements.txt requirements-full.txt ./
# CPU-only torch keeps the image ~2 GB smaller
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-full.txt

COPY . .
RUN useradd --create-home --uid 10001 appuser && mkdir -p /app/.cache && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
