// Reads a lab report IN THE BROWSER and returns its text.
// The original file never leaves the user's device - only the text is sent.
//
//   .txt ───────────────► decoded
//   digital PDF ────────► pdf.js text extraction
//   scanned PDF ────────► pdf.js renders pages ─┐
//   photo (JPG/PNG/WEBP) ──────────────────────┴► clean-up (imagePreprocess.js) ─► tesseract.js OCR
import { preprocessCanvas, toCanvas } from "./imagePreprocess.js";

export const MAX_FILE_MB = 15;
const MAX_PDF_PAGES = 30;
const MAX_OCR_PAGES = 10;
const MIN_TEXT_PER_PAGE = 40; // less than this = probably a scanned page

export class ReadError extends Error {}

// ── File type from its first bytes (never trust the file name) ─────────
function sniff(bytes) {
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "%PDF") return "pdf";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image";
  try {
    const sample = bytes.slice(0, 4096);
    if (!sample.includes(0)) {
      new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
      return "text";
    }
  } catch {
    /* not text */
  }
  return "unknown";
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── OCR engine (loaded once, from our own /ocr folder) ─────────────────
let workerPromise = null;
let progressListener = () => {};

function getWorker() {
  workerPromise ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1 /* LSTM engine */, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false, // load the worker as a normal file (allowed by our CSP)
      logger: (m) => {
        if (m.status === "recognizing text") progressListener(m.progress);
      },
    });
    // PSM 6 = "one uniform block of text": works best for lab-report tables
    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    return worker;
  })().catch((error) => {
    workerPromise = null;
    throw new ReadError(`Could not start the OCR engine: ${error.message}`);
  });
  return workerPromise;
}

async function ocrCanvas(canvas, onPageProgress) {
  const worker = await getWorker();
  progressListener = onPageProgress;
  const { data } = await worker.recognize(preprocessCanvas(canvas));
  return { text: data.text, confidence: data.confidence };
}

// ── PDF ─────────────────────────────────────────────────────────────────
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

async function readPdf(buffer, progress) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    if (error?.name === "PasswordException") {
      throw new ReadError("This PDF is password-protected. Please upload an unlocked copy.");
    }
    throw new ReadError("Could not read this PDF. Is the file damaged?");
  }
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new ReadError(`PDF has ${pdf.numPages} pages; the limit is ${MAX_PDF_PAGES}.`);

    // 1. Try the text layer (digital PDFs)
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      progress(`Reading page ${i} of ${pdf.numPages}`, i / pdf.numPages / 3);
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join(""));
    }
    const text = pages.join("\n").trim();
    if (text.length >= MIN_TEXT_PER_PAGE * pdf.numPages) {
      return { text, method: "pdf-text", pages: pdf.numPages, warnings: [] };
    }

    // 2. Scanned PDF -> render each page as an image and OCR it
    const count = Math.min(pdf.numPages, MAX_OCR_PAGES);
    const texts = [];
    const confidences = [];
    for (let i = 1; i <= count; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.5 }); // ~180 DPI
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      const result = await ocrCanvas(canvas, (p) =>
        progress(`Scanning page ${i} of ${count} (OCR)`, 1 / 3 + ((i - 1 + p) / count) * (2 / 3)));
      texts.push(result.text);
      confidences.push(result.confidence);
    }
    const warnings = pdf.numPages > MAX_OCR_PAGES ? [`Only the first ${MAX_OCR_PAGES} pages were scanned.`] : [];
    const confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return { text: texts.join("\n"), method: "ocr", pages: pdf.numPages, ocrConfidence: confidence, warnings };
  } finally {
    await loadingTask.destroy(); // frees the PDF worker's memory (pdf.js v6 API)
  }
}

// ── Photo ───────────────────────────────────────────────────────────────
async function readImage(file, progress) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // respect phone rotation
  } catch {
    throw new ReadError("Could not open this image. Is the file damaged?");
  }
  const canvas = toCanvas(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  const result = await ocrCanvas(canvas, (p) => progress("Scanning the photo (OCR)", 0.1 + p * 0.9));
  const warnings = result.confidence < 60
    ? ["The photo was hard to read. Check the values, or retake it flat, in good light and without shadows."]
    : [];
  return { text: result.text, method: "ocr", pages: 1, ocrConfidence: result.confidence, warnings };
}

/**
 * Read a report file. `onProgress(label, fraction 0-1)` reports progress.
 * Returns { text, method, pages, ocrConfidence?, warnings, fileHash }.
 */
export async function readReportFile(file, onProgress = () => {}) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new ReadError(`File is too large (max ${MAX_FILE_MB} MB).`);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const fileHash = await sha256Hex(buffer);

  let result;
  switch (sniff(bytes)) {
    case "text":
      result = { text: new TextDecoder().decode(bytes), method: "text", pages: 1, warnings: [] };
      break;
    case "pdf":
      result = await readPdf(buffer, onProgress);
      break;
    case "image":
      onProgress("Starting the OCR engine", 0.05);
      result = await readImage(file, onProgress);
      break;
    default:
      throw new ReadError("Unsupported file. Please upload a PDF, JPG, PNG, WEBP or TXT report.");
  }

  result.text = result.text.trim();
  if (result.text.length < 10) throw new ReadError("No readable text was found in this file.");
  return { ...result, fileHash };
}
