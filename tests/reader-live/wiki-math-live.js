async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));

  const cases = [
    { slug: "Pythagorean_theorem" },
    { slug: "Solar_System" },
    { slug: "Water" },
    { slug: "Periodic_table" }
  ];
  const openReader = async () => {
    await worker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(item => item.url === url);
      for (let attempt = 0; attempt < 15; attempt++) {
        try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
        catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    }, page.url());
    await page.waitForFunction(() => {
      const reader = document.querySelector("#raccoon-reader-root #reader-content");
      const source = document.querySelector("#mw-content-text .mw-parser-output");
      return !!reader && !!source && reader.querySelectorAll(".reader-math-expression").length === source.querySelectorAll(".mwe-math-element").length;
    }, { timeout: 30000 });
  };

  const results = [];
  for (const item of cases) {
    const response = await page.goto(`https://en.wikipedia.org/wiki/${item.slug}`, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForSelector("#mw-content-text .mw-parser-output", { timeout: 25000 });
    const source = await page.evaluate(() => {
      const main = document.querySelector("#mw-content-text .mw-parser-output");
      const formulas = [...main.querySelectorAll(".mwe-math-element")];
      const selected = [];
      for (const predicate of [node => node.classList.contains("mwe-math-element-block"), node => node.classList.contains("mwe-math-element-inline"), node => !!node.querySelector("mfrac,msqrt")]) {
        const node = formulas.find(candidate => predicate(candidate) && !selected.includes(candidate));
        if (node) selected.push(node);
      }
      const describe = node => {
        const image = node.querySelector("img");
        const math = node.querySelector("math");
        const imageRect = image?.getBoundingClientRect();
        const rootRect = node.getBoundingClientRect();
        return {
          displayClass: [...node.classList].filter(name => name.startsWith("mwe-math-element-")).join(" "),
          parentTag: node.parentElement?.tagName || "",
          parentClass: String(node.parentElement?.className || "").slice(0, 80),
          insideParagraph: !!node.closest("p"),
          image: image ? {
            ariaHidden: image.getAttribute("aria-hidden"), alt: image.alt,
            widthAttr: image.getAttribute("width"), heightAttr: image.getAttribute("height"),
            style: image.getAttribute("style") || "", computedWidth: getComputedStyle(image).width,
            computedHeight: getComputedStyle(image).height, verticalAlign: getComputedStyle(image).verticalAlign,
            rect: [imageRect.width, imageRect.height], natural: [image.naturalWidth, image.naturalHeight],
            source: image.currentSrc.split("/media/math/").pop()?.split("?")[0] || ""
          } : null,
          mathml: math ? {
            display: math.getAttribute("display") || "inline", alttext: math.getAttribute("alttext") || "",
            hiddenAncestor: !!math.closest("[style*='display: none']"),
            tags: [...new Set([math, ...math.querySelectorAll("*")].map(element => element.localName))].sort()
          } : null,
          bounds: [rootRect.width, rootRect.height]
        };
      };
      const chemical = [...main.querySelectorAll(".chemf")].slice(0, 4).map(node => ({ text: node.textContent.replace(/\s+/g, " ").trim(), sub: [...node.querySelectorAll("sub")].map(x => x.textContent), sup: [...node.querySelectorAll("sup")].map(x => x.textContent), html: node.innerHTML.slice(0, 160) }));
      const h2o = [...main.querySelectorAll("sub")].find(node => node.textContent.trim() === "2" && node.parentElement?.textContent.replace(/\s+/g, "").includes("H2O"));
      return {
        title: document.title,
        formulas: formulas.length,
        samples: selected.map(describe),
        h2o: h2o ? { parent: h2o.parentElement?.outerHTML.slice(0, 160), text: h2o.parentElement?.textContent } : null,
        chemistry: chemical
      };
    });
    await openReader();
    const reader = await page.evaluate(sourceInfo => {
      const content = document.querySelector("#reader-content");
      const mathNodes = [...content.querySelectorAll("math")];
      const chemistrySubs = [...content.querySelectorAll(".reader-orig-p sub")];
      return {
        mathmlCount: mathNodes.length,
        mathExpressions: content.querySelectorAll(".reader-math-expression").length,
        mathImages: content.querySelectorAll(".reader-math-expression img").length,
        sampleAlttextFound: sourceInfo.samples.map(sample => sample.mathml?.alttext ? mathNodes.some(math => math.getAttribute("alttext") === sample.mathml.alttext) : false),
        mathTags: [...new Set(mathNodes.flatMap(math => [math, ...math.querySelectorAll("*")].map(node => node.localName)))].sort(),
        sampleStructures: sourceInfo.samples.map(sample => {
          const math = mathNodes.find(node => node.getAttribute("alttext") === sample.mathml?.alttext);
          const wrapper = math?.closest(".reader-math-expression");
          return math ? { alttext: math.getAttribute("alttext"), display: math.getAttribute("display") || "inline", tags: [...new Set([math, ...math.querySelectorAll("*")].map(node => node.localName))].sort(), baseline: wrapper ? getComputedStyle(wrapper).verticalAlign : "" } : null;
        }),
        sourceToReaderBaselines: sourceInfo.samples.map(sample => {
          const math = mathNodes.find(node => node.getAttribute("alttext") === sample.mathml?.alttext);
          const wrapper = math?.closest(".reader-math-expression");
          return { display: sample.mathml?.display || "inline", source: sample.image?.verticalAlign || "", reader: wrapper ? getComputedStyle(wrapper).verticalAlign : "" };
        }),
        chemistrySubscriptCount: chemistrySubs.length,
        chemistryH2OPreserved: chemistrySubs.some(node => node.textContent.trim() === "2" && /H\s*2\s*O/.test(node.parentElement?.textContent.replace(/\s+/g, " ") || "")),
        referenceLinks: content.querySelectorAll(".reader-orig-p sup a[href]").length,
        contentOverflow: content.scrollWidth > content.clientWidth + 1
      };
    }, source);
    if (response?.status() !== 200) throw Error(`${item.slug}: HTTP ${response?.status()}`);
    if (reader.mathmlCount !== source.formulas || reader.mathExpressions !== source.formulas || reader.mathImages !== 0) throw Error(`${item.slug}: formula preservation/deduplication failed: ${JSON.stringify({ sourceCount: source.formulas, reader })}`);
    if (!reader.sampleAlttextFound.length || reader.sampleAlttextFound.some(found => !found)) throw Error(`${item.slug}: selected source formula alttext missing from reader: ${JSON.stringify(reader.sampleAlttextFound)}`);
    if (reader.contentOverflow) throw Error(`${item.slug}: article width overflowed`);
    if (item.slug === "Pythagorean_theorem") {
      if (source.samples.length !== 3 || !source.samples.some(sample => sample.mathml?.display === "block") || !source.samples.some(sample => sample.mathml?.display === "inline") || source.samples.some(sample => !sample.insideParagraph)) throw Error(`Pythagorean theorem: inline/block source structures were not sampled: ${JSON.stringify(source.samples)}`);
      if (!reader.mathTags.includes("msup") || !reader.mathTags.includes("mfrac") || reader.referenceLinks === 0) throw Error("Pythagorean theorem: square/fraction or citation structure missing");
      const inlineIndex = source.samples.findIndex(sample => sample.mathml?.display === "inline");
      const baseline = reader.sourceToReaderBaselines[inlineIndex];
      if (Math.abs(parseFloat(baseline.source || "0") - parseFloat(baseline.reader || "0")) > 2) throw Error(`Pythagorean theorem: inline baseline drifted: ${JSON.stringify(baseline)}`);
    }
    if (item.slug === "Solar_System" && (reader.chemistrySubscriptCount === 0 || reader.referenceLinks === 0)) throw Error("Solar System: units/subscripts or reference superscripts missing");
    if ((item.slug === "Water" || item.slug === "Periodic_table") && (!source.h2o || !reader.chemistryH2OPreserved || reader.chemistrySubscriptCount === 0)) throw Error(`${item.slug}: H2O subscript did not survive: ${JSON.stringify({ h2o: source.h2o, reader })}`);
    if (item.slug === "Water" && !reader.mathTags.includes("msub")) throw Error("Water: MathML subscript structure missing");
    results.push({ url: page.url(), status: response.status(), source, reader });
  }
  return { results, translation: "disabled; original view only" };
}
