// Headless runner for tests/reader-live/*.js ("async page => {...}" functions).
// Loads this source folder as an unpacked extension in Playwright's Chromium,
// so the reader fixtures run without the Codex playwright-cli wrapper.
//
//   node tests/run-reader-live.mjs tests/reader-live/regression.js
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright node tests/run-reader-live.mjs <test>
//
// Requires a local Playwright install (npx cache or PLAYWRIGHT_PATH). Fixture
// scripts route their own pages; *-live.js scripts open real websites.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCandidates = () => {
  const list = [];
  if (process.env.PLAYWRIGHT_PATH) list.push(process.env.PLAYWRIGHT_PATH);
  try { list.push(require.resolve('playwright')); } catch (_) {}
  const npx = path.join(os.homedir(), '.npm/_npx');
  for (const dir of fs.existsSync(npx) ? fs.readdirSync(npx) : []) {
    const candidate = path.join(npx, dir, 'node_modules/playwright');
    if (fs.existsSync(path.join(candidate, 'package.json'))) list.push(candidate);
  }
  return list;
};
const [,, testFile, ext = root] = process.argv;
if (!testFile) { console.error('usage: node tests/run-reader-live.mjs <test.js> [extensionDir]'); process.exit(2); }
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jijian-reader-'));
// Use the first cached Playwright whose bundled Chromium is actually installed.
let context = null, lastError = null;
for (const candidate of playwrightCandidates()) {
  try {
    const { chromium } = require(candidate);
    context = await chromium.launchPersistentContext(userDir, {
      headless: true, channel: 'chromium',
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
      viewport: { width: 1440, height: 1000 }
    });
    break;
  } catch (error) { lastError = error; }
}
if (!context) { console.error(String(lastError || 'Playwright not found; set PLAYWRIGHT_PATH')); process.exit(2); }
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
void worker;
const page = context.pages()[0] || await context.newPage();
const fn = (0, eval)(`(${fs.readFileSync(testFile, 'utf8').trim().replace(/;\s*$/, '')})`);
const started = Date.now();
let exitCode = 0;
try {
  const result = await fn(page);
  console.log(JSON.stringify({ ok: true, ms: Date.now() - started, result }, null, 1));
} catch (error) {
  exitCode = 1;
  console.log(JSON.stringify({ ok: false, ms: Date.now() - started, error: String(error?.stack || error).slice(0, 3000) }));
} finally {
  await context.close();
  fs.rmSync(userDir, { recursive: true, force: true });
}
process.exit(exitCode);
