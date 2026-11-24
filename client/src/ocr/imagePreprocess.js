// Computer-vision clean-up of a photo / scanned page BEFORE OCR (runs in the browser).
//
//  1. grayscale        colour adds noise; OCR only needs brightness
//  2. resize           OCR is most accurate when text is ~30 px tall
//  3. light correction divide each pixel by the local average brightness
//                      -> removes shadows and uneven phone-camera lighting
//  4. Otsu threshold   picks the best black/white cut-off automatically
//
// Same steps as the server's OpenCV version (ai-service/services/document_reader.py).

const TARGET_WIDTH = 3000;     // big enough that decimal points stay several pixels wide
const MAX_PIXELS = 16_000_000; // keep memory use sane on phones

/** Draw any image source onto a canvas at an OCR-friendly size. */
export function toCanvas(source, width, height) {
  let scale = width < TARGET_WIDTH ? TARGET_WIDTH / width : 1;
  if (width * height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (width * height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Otsu's method: the threshold that best separates dark text from light paper. */
function otsuThreshold(histogram, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += t * histogram[t];
    const meanB = sumBackground / weightBackground;
    const meanF = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Clean the canvas in place and return it. */
export function preprocessCanvas(canvas) {
  const { width, height } = canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const n = width * height;

  // 1. grayscale (perceived brightness)
  const gray = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];

  // 3. light correction using an integral image (fast local average)
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + row;
    }
  }
  const r = Math.max(15, Math.round(width / 40)); // window ~ a few letters wide
  const normalized = new Uint8ClampedArray(n);
  const histogram = new Uint32Array(256);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);
      const area = (y1 - y0) * (x1 - x0);
      const s = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1]
              - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      const mean = s / area || 1;
      const value = Math.min(255, (gray[y * width + x] / mean) * 230);
      normalized[y * width + x] = value;
      histogram[value | 0]++;
    }
  }

  // 4. Contrast stretch around the Otsu threshold - but keep GRAYSCALE edges.
  //    A hard black/white cut erases tiny decimal points ("10.9" -> "109"),
  //    which is dangerous for lab values. Tesseract's LSTM engine reads
  //    clean grayscale better and binarises internally.
  const t = otsuThreshold(histogram, n);
  const low = Math.max(0, t - 60);
  const high = Math.min(255, t + 25);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = ((normalized[i] - low) / (high - low)) * 255;
    px[j] = px[j + 1] = px[j + 2] = v; // Uint8ClampedArray clamps to 0-255
    px[j + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
