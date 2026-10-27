// Tesseract worker for non-sandboxed hosts (Safari): hides Tesseract's benign
// diagnostics, then loads the bundled runtime from the extension.
(() => {
  const benign = args => {
    const message = args.map(value => String(value ?? "")).join(" ").trim();
    return /^Warning: Parameter not found: [a-z0-9_]+$/i.test(message) || /^Estimating resolution as \d+$/i.test(message);
  };
  for (const method of ["log", "warn", "error"]) {
    const original = console[method]?.bind(console);
    if (original) console[method] = (...args) => { if (!benign(args)) original(...args); };
  }
  importScripts("vendor/tesseract/worker.min.js");
})();
