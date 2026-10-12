// pdf.js's worker starts listening on `self` as soon as it is evaluated. Legacy
// build to match the main thread's (see `loadPdfJs`).
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
