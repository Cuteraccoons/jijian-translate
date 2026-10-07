async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false, readerTheme: "white" }));
  const longTerms = Array.from({ length: 36 }, (_, index) => `<msup><mi>x</mi><mn>${index + 1}</mn></msup>`).join("<mo>+</mo>");
  await page.route("https://reader-math-export.example/**", route => {
    const url = route.request().url();
    if (url.endsWith("/broken.svg")) return route.abort();
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48"><text x="2" y="32">fallback</text></svg>' });
  });
  const prose = "This article explains how mathematical notation, scientific writing, and readable source text should remain together when a page is opened in a focused reading view. ".repeat(3);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Math export fixture</title></head><body><main class="mw-parser-output"><h1>Math export</h1><p>${prose}</p><p>Before <span class="mwe-math-element mwe-math-element-inline"><span style="display:none"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="a^2+b^2=c^2"><semantics><mrow><msup><mi>a</mi><mn>2</mn></msup><mo>+</mo><msup><mi>b</mi><mn>2</mn></msup><mo>=</mo><msup><mi>c</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">a^2+b^2=c^2</annotation></semantics></math></span><img src="https://reader-math-export.example/good.svg" aria-hidden="true" alt="a squared plus b squared equals c squared" style="vertical-align:-0.2ex;width:3ex;height:1.4ex"></span> after.</p><p>Long equation: <span class="mwe-math-element mwe-math-element-block"><span style="display:none"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" alttext="long display equation"><mrow>${longTerms}<mo>=</mo><mn>0</mn></mrow></math></span></span></p><p>Image only: <span class="mwe-math-element mwe-math-element-inline"><img src="https://reader-math-export.example/good.svg" aria-hidden="true" alt="image only formula" style="vertical-align:-0.2ex;width:3ex;height:1.4ex"></span>.</p><p>Broken fallback: <span class="mwe-math-element mwe-math-element-inline"><img src="https://reader-math-export.example/broken.svg" aria-hidden="true" alt="integral from zero to one"></span>.</p><p>Water: H<sub>2</sub>O.</p></main></body></html>`;
  await page.route("https://en.wikipedia.org/wiki/Reader_Math_Export_Fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  const response = await page.goto("https://en.wikipedia.org/wiki/Reader_Math_Export_Fixture", { waitUntil: "domcontentloaded" });
  await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === url);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForSelector('#raccoon-reader-root #reader-content .reader-math-expression-block math[alttext="long display equation"]', { timeout: 25000 });
  await page.waitForSelector('#raccoon-reader-root #reader-content .reader-math-fallback-text[aria-label="integral from zero to one"]', { timeout: 15000 });
  const readerState = await page.evaluate(() => ({ math: document.querySelectorAll("#reader-content math").length, textFallback: document.querySelector("#reader-content .reader-math-fallback-text[aria-label='integral from zero to one']")?.textContent, subscript: document.querySelector("#reader-content sub")?.textContent }));
  if (response?.status() !== 200 || readerState.math !== 2 || readerState.textFallback !== "integral from zero to one" || readerState.subscript !== "2") throw Error(`Reader fallback setup failed: ${JSON.stringify({ status: response?.status(), readerState })}`);

  await page.locator('[data-reader-tool-tab="article"]').evaluate(button => button.click());
  const htmlPending = page.waitForEvent("download", { timeout: 10000 });
  await page.locator('#reader-export-menu [data-format="html"]').evaluate(button => button.click());
  const htmlDownload = await htmlPending;
  const markdownPending = page.waitForEvent("download", { timeout: 10000 });
  await page.locator('#reader-export-menu [data-format="md"]').evaluate(button => button.click());
  const markdownDownload = await markdownPending;
  await page.locator('#reader-export-menu [data-format="print"]').evaluate(button => button.click());
  await page.waitForFunction(() => {
    const frame = document.querySelector("iframe.reader-export-print-frame");
    return frame?.contentDocument?.readyState === "complete" && !!frame.contentDocument.querySelector(".reader-content .reader-math-fallback-text[aria-label='integral from zero to one']");
  }, { timeout: 15000 });
  const pdfPrintDocument = await page.locator("iframe.reader-export-print-frame").evaluate(frame => {
    const content = frame.contentDocument.querySelector(".reader-content");
    return {
      mathAlttexts: [...content.querySelectorAll("math")].map(node => node.getAttribute("alttext")),
      imageAlts: [...content.querySelectorAll(".reader-math-fallback-image")].map(node => node.alt),
      textAlternatives: [...content.querySelectorAll(".reader-math-fallback-text")].map(node => ({ text: node.textContent, label: node.getAttribute("aria-label") })),
      chemistrySubscript: content.querySelector("sub")?.textContent,
      longFormula: (() => { const math = [...content.querySelectorAll("math")].find(node => node.getAttribute("alttext") === "long display equation"); const block = math?.closest(".reader-math-expression-block"); return block ? { overflowX: getComputedStyle(block).overflowX, scrollWidth: block.scrollWidth, clientWidth: block.clientWidth, width: math.getBoundingClientRect().width } : null; })(),
      printRulePresent: [...frame.contentDocument.styleSheets].some(sheet => {
        const hasRule = rules => [...rules].some(rule => rule.cssText.includes(".reader-math-expression-block math") && rule.cssText.includes("width: auto"));
        return hasRule(sheet.cssRules) || [...sheet.cssRules].some(rule => rule.cssRules && hasRule(rule.cssRules));
      })
    };
  });
  if (!pdfPrintDocument.mathAlttexts.includes("a^2+b^2=c^2") || !pdfPrintDocument.mathAlttexts.includes("long display equation") || !pdfPrintDocument.imageAlts.includes("image only formula") || !pdfPrintDocument.textAlternatives.some(item => item.label === "integral from zero to one" && item.text === item.label) || pdfPrintDocument.chemistrySubscript !== "2" || !pdfPrintDocument.longFormula || pdfPrintDocument.longFormula.overflowX !== "auto" || pdfPrintDocument.longFormula.scrollWidth <= pdfPrintDocument.longFormula.clientWidth || !pdfPrintDocument.printRulePresent) throw Error(`HTML/PDF export lost MathML alternatives, formula scroll, print layout, or chemical subscripts: ${JSON.stringify(pdfPrintDocument)}`);
  return { html: htmlDownload.suggestedFilename(), markdown: markdownDownload.suggestedFilename(), pdfPrintDocument };
}
