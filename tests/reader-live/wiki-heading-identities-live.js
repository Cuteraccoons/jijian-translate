async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false, readerOutlineCollapsed: false }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const cases = [
    { name: "Germany", url: "https://en.wikipedia.org/wiki/Germany" },
    { name: "北京市", url: "https://zh.wikipedia.org/wiki/北京" },
    { name: "日本語", url: "https://ja.wikipedia.org/wiki/日本語" },
    { name: "Berlin", url: "https://de.wikipedia.org/wiki/Berlin" }
  ];
  const normalize = value => String(value || "").replace(/[\s\p{P}\p{S}]+/gu, "");
  const results = [];
  for (const item of cases) {
    let response;
    try { response = await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 35000 }); }
    catch (error) { results.push({ name: item.name, status: null, available: false, reason: String(error).slice(0, 180) }); continue; }
    let source;
    try {
      await page.waitForSelector("#mw-content-text .mw-parser-output", { timeout: 12000 });
      source = await page.evaluate(() => {
        const main = document.querySelector("#mw-content-text .mw-parser-output");
        const headings = [...main.querySelectorAll("h2,h3,h4,h5,h6")].filter(node => !node.closest(".navbox,.sistersitebox,.sidebar,[hidden]")).map(node => {
          const clone = node.cloneNode(true);
          clone.querySelectorAll(".mw-editsection,.mw-editsection-like,.mw-editsection-visualeditor").forEach(edit => edit.remove());
          return {
            text: clone.textContent.replace(/\s+/g, " ").trim(),
            level: Number(node.tagName.slice(1)),
            id: node.id || node.querySelector("[id]")?.id || node.parentElement?.id || ""
          };
        }).filter(item => item.text);
        return { url: location.href, title: document.title, language: document.documentElement.lang, headings, shellTocCount: document.querySelectorAll("#vector-toc,#toc").length };
      });
    } catch (error) {
      results.push({ name: item.name, status: response?.status() || null, available: false, title: await page.title(), reason: String(error).slice(0, 180) });
      continue;
    }
    if (response?.status() !== 200 || /captcha|verify|验证/i.test(source.title)) {
      results.push({ name: item.name, status: response?.status() || null, available: false, title: source.title, reason: "source unavailable or verification page" });
      continue;
    }
    const targetUrl = page.url();
    await worker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(candidate => candidate.url === url);
      if (!tab) throw Error("Current Wikipedia article tab not found");
      for (let attempt = 0; attempt < 15; attempt++) {
        try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
        catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    }, targetUrl);
    await page.waitForSelector("#raccoon-reader-root #reader-content", { timeout: 30000 });
    const output = await page.evaluate(() => {
      const root = document.querySelector("#raccoon-reader-root"), content = root.querySelector("#reader-content");
      return {
        headings: [...content.querySelectorAll(".reader-paragraph-pair[data-heading='true']")].map(pair => ({
          text: pair.querySelector(".reader-orig-p")?.textContent.replace(/\s+/g, " ").trim() || "",
          level: Number(pair.dataset.headingLevel),
          id: pair.id
        })),
        outline: [...root.querySelectorAll(".reader-outline-item")].map(item => ({ text: item.querySelector(".reader-outline-label")?.textContent.replace(/\s+/g, " ").trim() || "", level: Number(item.dataset.headingLevel), id: item.dataset.targetId, exists: !!root.querySelector("#" + CSS.escape(item.dataset.targetId)) })),
        shellTocLeaked: content.textContent.includes("Contents") || content.textContent.includes("目录") || content.textContent.includes("コンテンツ"),
        contentWidth: content.clientWidth,
        contentScrollWidth: content.scrollWidth
      };
    });
    const differences = source.headings.map((heading, index) => {
      const actual = output.headings[index], outline = output.outline[index];
      const kinds = [];
      if (!actual || normalize(actual.text) !== normalize(heading.text)) kinds.push("text-or-order");
      if (actual && actual.level !== heading.level) kinds.push("level");
      if (!outline || !outline.exists || outline.level !== heading.level || normalize(outline.text) !== normalize(heading.text)) kinds.push("outline-target");
      return kinds.length ? { index, source: heading, output: actual || null, outline: outline || null, kinds } : null;
    }).filter(Boolean);
    const candidates = [...new Set([0, Math.floor((source.headings.length - 1) / 2), source.headings.length - 1].filter(index => index >= 0))].map(index => source.headings[index]).filter(heading => heading?.id);
    const clickChecks = await page.evaluate(ids => ids.map(id => {
      const content = document.querySelector("#reader-content"), link = document.createElement("a");
      link.href = "#" + encodeURIComponent(id); link.textContent = "heading identity probe"; link.style.cssText = "position:absolute;left:-10000px"; content.append(link);
      const event = new MouseEvent("click", { bubbles: true, cancelable: true }); link.dispatchEvent(event); link.remove();
      return { id, mapped: event.defaultPrevented };
    }), candidates.map(heading => heading.id));
    results.push({ name: item.name, status: response.status(), available: true, url: source.url, language: source.language, sourceHeadingCount: source.headings.length, readerHeadingCount: output.headings.length, outlineCount: output.outline.length, differenceCount: differences.length, differences: differences.slice(0, 12), clickChecks, shellTocCount: source.shellTocCount, shellTocLeaked: output.shellTocLeaked, noHorizontalOverflow: output.contentScrollWidth <= output.contentWidth + 1 });
  }
  return { results, translation: "disabled; original view only", note: "Source headings inside navigation templates are excluded; differences are candidates for manual structure review." };
}
