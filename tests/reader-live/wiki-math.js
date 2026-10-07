async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false, readerTheme: "white" }));

  const math = (name, display, body, options = {}) => {
    const alt = options.alt || name;
    const mathml = `<span class="mwe-math-mathml-a11y" style="display:none"><math xmlns="http://www.w3.org/1998/Math/MathML"${display === "block" ? ' display="block"' : ""} alttext="${alt}"><semantics><mrow>${body}</mrow><annotation encoding="application/x-tex">${alt}</annotation></semantics></math></span>`;
    const image = options.image === false ? "" : `<img class="mwe-math-fallback-image-${display}" src="https://reader-math-fixture.example/${name}.svg" aria-hidden="true" alt="${alt}" style="${options.imageStyle || "vertical-align:-0.2ex;width:3ex;height:1.4ex"}">`;
    const data = { name: "math", attrs: { display, ...(options.dataAlt ? { alttext: alt } : {}) } };
    return `<span id="${name}" class="mwe-math-element mwe-math-element-${display}" data-mw="${JSON.stringify(data).replaceAll('"', '&quot;')}">${options.mathml === false ? "" : mathml}${image}</span>`;
  };
  const inlineDual = math("dual-inline", "inline", "<msup><mi>a</mi><mn>2</mn></msup><mo>+</mo><msup><mi>b</mi><mn>2</mn></msup><mo>=</mo><msup><mi>c</mi><mn>2</mn></msup>", { alt: "a^2+b^2=c^2" });
  const blockOnlyMathml = math("block-mathml", "block", "<msqrt><mrow><mo>(</mo><mfrac><mi>x</mi><mi>y</mi></mfrac><mo>)</mo></mrow></msqrt>", { alt: "sqrt((x/y))", image: false });
  const imageOnly = math("image-only", "inline", "", { alt: "integral from 0 to 1 of x dx", mathml: false });
  const blockImageOnly = math("block-image-only", "block", "", { alt: "long image-only display equation", mathml: false, imageStyle: "vertical-align:0;width:80ex;height:6ex" });
  const mathmlOnly = math("mathml-only", "inline", "<mfrac><msup><mi>x</mi><mn>2</mn></msup><mn>3</mn></mfrac>", { alt: "x^2/3", image: false });
  const noImageAlt = math("no-image-alt", "inline", "", { alt: "limit as n approaches infinity of 1/n", mathml: false, image: false, dataAlt: true });
  const brokenImage = math("broken-image", "inline", "", { alt: "sum from k equals 1 to n of k", mathml: false });
  const longTerms = Array.from({ length: 70 }, (_, index) => `<msup><mi>x</mi><mn>${index + 1}</mn></msup>`).join("<mo>+</mo>");
  const longBlock = math("long-block", "block", `<mrow>${longTerms}<mo>=</mo><mn>0</mn></mrow>`, { alt: "Long display formula for local horizontal scrolling", image: false });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Math fixture</title></head><body><main class="mw-parser-output"><h1>Math fixture</h1><p id="inline-proof">Before ${inlineDual} after <sup class="reference"><a href="#cite_note_1">[1]</a></sup>.</p><div id="standalone-proof">${blockOnlyMathml}</div><p id="image-proof">Image fallback: ${imageOnly}.</p><div id="block-image-proof">Block image fallback: ${blockImageOnly}</div><p id="broken-image-proof">Broken image fallback: ${brokenImage}.</p><p id="no-image-alt-proof">Text fallback: ${noImageAlt}.</p><p id="mathml-proof">MathML fallback: ${mathmlOnly}.</p><p id="long-proof">${longBlock}</p><p id="chemistry-proof"><span class="chemf">H<sub>2</sub>O</span> is water; citation <sup class="reference"><a href="#cite_note_1">[1]</a></sup>.</p><aside aria-hidden="true"><a href="#">HIDDEN NAVIGATION SENTINEL</a></aside><ol><li id="cite_note_1">A short self-authored citation.</li></ol></main></body></html>`;
  await page.route("https://reader-math-fixture.example/**", route => {
    const name = route.request().url().split("/").pop();
    if (name === "broken-image.svg") return route.abort();
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48"><rect width="120" height="48" fill="white"/><text x="2" y="32" font-size="16">${name.replace(/\.svg$/, "")}</text></svg>` });
  });
  await page.route("https://en.wikipedia.org/wiki/Reader_Math_Fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.setViewportSize({ width: 390, height: 900 });
  const response = await page.goto("https://en.wikipedia.org/wiki/Reader_Math_Fixture", { waitUntil: "domcontentloaded" });
  const source = await page.evaluate(() => [...document.querySelectorAll(".mwe-math-element")].map(node => ({ id: node.id, displayClass: node.className, mathml: !!node.querySelector("math"), image: !!node.querySelector("img"), imageAriaHidden: node.querySelector("img")?.getAttribute("aria-hidden") === "true", alttext: node.querySelector("math")?.getAttribute("alttext") || node.querySelector("img")?.alt || (() => { try { const data = JSON.parse(node.getAttribute("data-mw") || "{}"); return data.attrs?.alttext || data.body?.extsrc || ""; } catch (_) { return ""; } })(), imageStyle: node.querySelector("img")?.getAttribute("style") || "", imageVerticalAlign: node.querySelector("img") ? getComputedStyle(node.querySelector("img")).verticalAlign : "" })));
  await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === url);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForFunction(() => document.querySelectorAll("#raccoon-reader-root #reader-content .reader-math-expression").length === 8, { timeout: 25000 });
  await page.waitForSelector('#raccoon-reader-root #reader-content .reader-math-fallback-text[aria-label="sum from k equals 1 to n of k"]', { timeout: 15000 });
  const reader = await page.evaluate(() => {
    const content = document.querySelector("#reader-content");
    return {
      text: content.textContent.replace(/\s+/g, " "),
      mathCount: content.querySelectorAll("math").length,
      mathTags: [...content.querySelectorAll("math")].map(node => [...node.querySelectorAll("msup,mfrac,msqrt")].map(child => child.tagName.toLowerCase())),
      images: [...content.querySelectorAll("img")].filter(node => node.closest(".reader-math-expression")).map(node => ({ alt: node.alt, src: node.src.split(".example").pop(), naturalWidth: node.naturalWidth })),
      expressionCount: content.querySelectorAll(".reader-math-expression").length,
      displayModes: [...content.querySelectorAll(".reader-math-expression")].map(node => node.dataset.readerMathDisplay),
      fallbackTexts: [...content.querySelectorAll(".reader-math-fallback-text")].map(node => ({ text: node.textContent, label: node.getAttribute("aria-label") })),
      chemistrySubscripts: [...content.querySelectorAll(".reader-orig-p sub")].map(node => node.textContent),
      referenceSuperscripts: [...content.querySelectorAll(".reader-orig-p sup a[href]")].map(node => ({ text: node.textContent, href: node.getAttribute("href") })),
      inlineMathBaseline: (() => { const math = [...content.querySelectorAll("math")].find(node => node.getAttribute("alttext") === "a^2+b^2=c^2"); const wrapper = math?.closest(".reader-math-expression"); return wrapper ? getComputedStyle(wrapper).verticalAlign : ""; })(),
      standaloneMath: !!content.querySelector('.reader-math-block math[alttext="sqrt((x/y))"]'),
      bracketFormulaText: [...content.querySelectorAll("math")].find(node => node.getAttribute("alttext") === "sqrt((x/y))")?.textContent || "",
      blockImageFormula: (() => { const image = [...content.querySelectorAll(".reader-math-expression-block img")].find(node => node.alt === "long image-only display equation"); const block = image?.closest(".reader-math-expression-block"); return block ? { clientWidth: block.clientWidth, scrollWidth: block.scrollWidth, imageWidth: image.getBoundingClientRect().width } : null; })(),
      hiddenNavigationPresent: content.textContent.includes("HIDDEN NAVIGATION SENTINEL"),
      contentOverflow: content.scrollWidth > content.clientWidth + 1,
      longFormula: (() => { const math = [...content.querySelectorAll("math")].find(node => node.getAttribute("alttext") === "Long display formula for local horizontal scrolling"); const block = math?.closest(".reader-math-expression-block"); return block ? { clientWidth: block.clientWidth, scrollWidth: block.scrollWidth, parentClientWidth: block.parentElement.clientWidth, mathWidth: math.getBoundingClientRect().width } : null; })()
    };
  });
  if (response?.status() !== 200) throw Error(`Fixture HTTP status ${response?.status()}`);
  if (source.length !== 8) throw Error(`Expected eight source MathML container cases, got ${source.length}`);
  if (reader.mathCount !== 4 || reader.expressionCount !== 8) throw Error(`MathML/image deduplication failed: ${JSON.stringify({ mathCount: reader.mathCount, expressionCount: reader.expressionCount, mathAlts: await page.locator("#reader-content math").evaluateAll(nodes => nodes.map(node => node.getAttribute("alttext"))), expressionAlts: await page.locator("#reader-content .reader-math-expression").evaluateAll(nodes => nodes.map(node => ({ display: node.dataset.readerMathDisplay, text: node.textContent.slice(0, 70) }))) })}`);
  if (!reader.mathTags.some(tags => tags.includes("msqrt") && tags.includes("mfrac")) || !reader.mathTags.some(tags => tags.includes("mfrac") && tags.includes("msup")) || !reader.bracketFormulaText.includes("(") || !reader.bracketFormulaText.includes(")")) throw Error(`Expected radical, fraction, bracket and superscript structure: ${JSON.stringify({ tags: reader.mathTags, bracket: reader.bracketFormulaText })}`);
  if (!reader.text.includes("Before a2+b2=c2 after") || !reader.standaloneMath || reader.referenceSuperscripts.length < 2) throw Error(`Inline text, standalone math, or citation superscripts were lost: ${JSON.stringify(reader)}`);
  if (reader.chemistrySubscripts.join("") !== "2") throw Error(`H2O subscript not retained: ${JSON.stringify(reader.chemistrySubscripts)}`);
  const sourceBaseline = parseFloat(source.find(item => item.id === "dual-inline")?.imageVerticalAlign || "0");
  const readerBaseline = parseFloat(reader.inlineMathBaseline || "0");
  if (Math.abs(sourceBaseline - readerBaseline) > 1.5) throw Error(`Inline formula baseline drifted: source=${sourceBaseline}px reader=${readerBaseline}px`);
  if (reader.hiddenNavigationPresent) throw Error("aria-hidden navigation leaked into reader output");
  if (!reader.images.some(image => image.src.includes("image-only.svg") && image.naturalWidth === 120)) throw Error(`Visible aria-hidden image fallback missing: ${JSON.stringify(reader.images)}`);
  if (!reader.blockImageFormula || reader.blockImageFormula.scrollWidth <= reader.blockImageFormula.clientWidth) throw Error(`Long block image formula does not scroll in its own container: ${JSON.stringify(reader.blockImageFormula)}`);
  if (!reader.fallbackTexts.some(item => item.label === "sum from k equals 1 to n of k") || !reader.fallbackTexts.some(item => item.label === "limit as n approaches infinity of 1/n")) throw Error(`Broken-image or no-image visible text fallback missing: ${JSON.stringify({ images: reader.images, fallbackTexts: reader.fallbackTexts })}`);
  if (reader.contentOverflow) throw Error("Formula caused whole reader content to overflow at narrow width");
  if (!reader.longFormula || reader.longFormula.scrollWidth <= reader.longFormula.clientWidth) throw Error(`Long display formula does not scroll in its own container: ${JSON.stringify(reader.longFormula)}`);

  const narrowLayout = await page.evaluate(() => ({ viewport: innerWidth, reader: document.querySelector("#reader-content").scrollWidth, client: document.querySelector("#reader-content").clientWidth }));
  await page.setViewportSize({ width: 1280, height: 900 });
  const wideLayout = await page.evaluate(() => ({ viewport: innerWidth, reader: document.querySelector("#reader-content").scrollWidth, client: document.querySelector("#reader-content").clientWidth }));
  const darkButton = page.locator('[data-reader-theme-quick="dark"]');
  if (!await darkButton.isVisible()) await page.locator("#reader-btn-open-settings").click();
  await page.locator('[data-reader-tool-tab="appearance"]').click();
  await darkButton.click();
  const darkTheme = await page.locator("#reader-content math").first().evaluate(node => ({ rootTheme: document.querySelector("#raccoon-reader-root").dataset.theme, activeChoice: document.querySelector("[data-reader-theme-quick].active")?.dataset.readerThemeQuick, color: getComputedStyle(node).color, background: getComputedStyle(node.closest(".reader-scroll-card")).backgroundColor }));
  if (darkTheme.rootTheme !== "dark" || darkTheme.color === darkTheme.background) throw Error(`MathML is not legible in dark theme: ${JSON.stringify(darkTheme)}`);
  await page.locator('[data-reader-theme-quick="white"]').click();
  const whiteTheme = await page.locator("#reader-content math").first().evaluate(node => ({ rootTheme: document.querySelector("#raccoon-reader-root").dataset.theme, color: getComputedStyle(node).color, background: getComputedStyle(node.closest(".reader-scroll-card")).backgroundColor }));
  if (whiteTheme.rootTheme !== "white" || whiteTheme.color === whiteTheme.background) throw Error(`MathML is not legible in white theme: ${JSON.stringify(whiteTheme)}`);

  return { status: response?.status(), source, reader, narrowLayout, wideLayout, darkTheme, whiteTheme, translation: "disabled; original view only" };
}
