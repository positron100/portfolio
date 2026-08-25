/**
 * Renders page 1 of each certificate PDF to a JPEG preview.
 *
 * Run manually after adding or replacing a certificate:
 *   node scripts/render-certificate-previews.mjs
 *
 * The previews are committed as static assets rather than rendered in the
 * browser, so the site never ships a PDF engine: pdfjs-dist and
 * @napi-rs/canvas are devDependencies and stay out of the bundle entirely.
 * Originals in `Certificates/` are never touched; this only reads the copies
 * under `public/certificates/` and writes `.jpg` files beside them.
 */
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// pdf.js assumes browser globals and, in Node, reaches for the `canvas`
// package by default. @napi-rs/canvas ships prebuilt binaries instead of
// needing a native toolchain, so it is wired in by hand: the globals below,
// plus the canvas factory passed to `getDocument`.
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.Path2D ??= Path2D;
globalThis.ImageData ??= ImageData;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/certificates");
/** Bundled with pdfjs-dist. Without it, any PDF relying on a standard font
 * fails to render its text. */
const standardFontDataUrl = path.join(root, "node_modules/pdfjs-dist/standard_fonts/");

const canvasFactory = {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  },
  reset(target, width, height) {
    target.canvas.width = width;
    target.canvas.height = height;
  },
  destroy(target) {
    target.canvas.width = 0;
    target.canvas.height = 0;
  },
};
/** Long edge of the output, in px. Large enough to stay readable when the
 * modal shows it near full-screen, small enough not to bloat the repo. */
const LONG_EDGE = 1600;
const QUALITY = 0.86;

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const files = (await readdir(dir)).filter((f) => f.endsWith(".pdf"));
for (const file of files) {
  const data = new Uint8Array(await readFile(path.join(dir, file)));
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    standardFontDataUrl,
    canvasFactory,
  }).promise;
  const page = await doc.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const scale = LONG_EDGE / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const context = canvas.getContext("2d");
  // Certificates are designed on white. Without this the transparent areas
  // become black once flattened into a JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;

  const out = path.join(dir, file.replace(/\.pdf$/, ".jpg"));
  const buffer = await canvas.encode("jpeg", Math.round(QUALITY * 100));
  await writeFile(out, buffer);
  console.log(
    `${file} -> ${path.basename(out)}  ${canvas.width}x${canvas.height}  ` +
      `${Math.round(buffer.length / 1024)}KB  (${doc.numPages} page${doc.numPages > 1 ? "s" : ""})`,
  );
}
