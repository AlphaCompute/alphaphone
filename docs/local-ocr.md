# Local Camera Scan

Camera Scan captures and retains a photo, runs English OCR on this device, and opens an editable review dialog. Copy uses the clipboard only after a click. Save to Notes writes the corrected text through the existing Notes persistence boundary and reports success only after a confirmed commit. A failed or uncertain save retains the text and disables repeat submission. Scanning does not send pixels or text to the agent or a model provider.

The same renderer implementation and packaged assets are used by browser development and Android web assets. Actual Android WebView execution and physical camera accuracy remain unverified in this browser-only pass. English text extraction does not yet implement the design's document boundaries, event recognition, Add event, link detection, PDF export, or automatic language selection. These remain open requirements, not simulated successes.

## Runtime and packaging

`local-ocr.ts` owns a classic Worker from creation through termination. It uses the pinned Tesseract.js 7.0.0 worker protocol because the high-level asynchronous createWorker call exposes its handle only after model initialization. The real-engine browser test checks that protocol. Leaving Camera, hiding the page, closing the dialog or pressing Back cancels and terminates the worker, including while loading the model. One recognition is bounded to 60 seconds; input is JPEG/PNG/WebP up to 16 MB and 32 million pixels, resized to a maximum 2048-pixel edge. Review text is limited to 100,000 characters. Recognition accuracy varies with focus, orientation and print quality; users review the result.

`local-ocr-assets.ts` serves an exact allowlist under `/ocr/` in development and emits the same files into `web-dist/ocr/` for packaging. The package lock pins worker 7.0.0, core 6.1.2 and English data 1.0.0. Scalar, SIMD and relaxed-SIMD LSTM cores contain their WASM; feature detection selects one. No CDN defaults are used. The compressed English integer model is approximately 2.95 MB; the three JavaScript/WASM cores total approximately 11.7 MB. Only one core loads per scan. Total packaged assets are approximately 14.8 MB; model caching is disabled in the OCR library.

Upstream API and local installation references: [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md). The worker and core license files ship beside the assets. The [tessdata repository Apache 2.0 license](https://github.com/naptha/tessdata/blob/gh-pages/LICENSE) is retained in `licenses/tessdata-APACHE-2.0.txt` and emitted with the model. The npm language package metadata separately declares MIT; it wraps the upstream trained data.

## Browser evidence

`test/browser/local-ocr.spec.ts` uses real Tesseract worker/WASM/model execution. It verifies recognizable generated print, local asset requests with no remote requests, early cancellation, Camera Scan through a synthetic camera stream with real JPEG/IndexedDB and Notes reload, retained text on an explicitly injected unconfirmed save, and cancellation while model loading is held. Synthetic camera pixels and injected persistence failures are test fixtures, not hardware evidence. Existing browser camera save/denial/late-permission cases are also rerun. No Android build is performed.
