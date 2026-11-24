// Copies the in-browser OCR engine (tesseract.js) into public/ocr/ so it is
// served from OUR domain (no third-party CDN -> stricter security policy).
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = path.join(root, "node_modules");
const out = path.join(root, "public", "ocr");

const files = [
  // [from (inside node_modules), to (inside public/ocr)]
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  // LSTM engine builds (the modern, accurate Tesseract engine) - with and without SIMD
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm", "core/tesseract-core-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm", "core/tesseract-core-simd-lstm.wasm"],
  // English model, compact "best_int" version (~3 MB)
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
];

for (const [from, to] of files) {
  const source = path.join(modules, from);
  if (!existsSync(source)) {
    console.error(`✖ Missing ${from} - run "npm install" first.`);
    process.exit(1);
  }
  const target = path.join(out, to);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}
console.log(`✔ OCR assets copied to public/ocr (${files.length} files)`);
