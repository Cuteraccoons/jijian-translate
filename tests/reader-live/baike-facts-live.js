async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));
  const cases = [
    { name: "周杰伦", url: "https://baike.baidu.com/item/周杰伦/129156" },
    { name: "水", url: "https://baike.baidu.com/item/水/34133" },
    { name: "杭州市", url: "https://baike.baidu.com/item/杭州市/200167" },
    { name: "清华大学", url: "https://baike.baidu.com/item/清华大学/111764" }
  ];
  const inspectSource = () => page.evaluate(() => {
    const root = document.querySelector(".J-basic-info,.basic-info");
    if (!root) return null;
    const isVisible = source => {
      for (let current = source; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (current.hidden || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return false;
        if (current.tagName === "DETAILS" && !current.open && current !== source) return false;
        if (current === root) break;
      }
      return true;
    };
    const normalizeLabel = value => String(value || "")
      .replace(/([\p{Script=Han}])(?:\u00a0{2,}|\u3000+)(?=[\p{Script=Han}])/gu, "$1")
      .replace(/\s+/g, " ").trim();
    const normalizeText = value => String(value || "").replace(/\s+/g, " ").trim();
    const normalizeValue = value => normalizeText(value).replace(/\s+/g, "");
    const terms = [...root.querySelectorAll("dt")];
    const rows = terms.map(term => {
      if (!isVisible(term)) return null;
      const list = term.closest("dl") || root;
      const listTerms = terms.filter(candidate => (candidate.closest("dl") || root) === list);
      const nextTerm = listTerms[listTerms.indexOf(term) + 1] || null;
      const follows = (before, after) => !!(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
      const values = [...list.querySelectorAll("dd")].filter(value =>
        (value.closest("dl") || root) === list && follows(term, value) && (!nextTerm || follows(value, nextTerm)) && isVisible(value)
      ).filter(value => normalizeText(value.innerText || value.textContent) || [...value.querySelectorAll("img")].some(image => isVisible(image) && !!(image.currentSrc || image.getAttribute("src") || image.getAttribute("data-src"))));
      const label = normalizeLabel(term.textContent);
      if (!label || !values.length) return null;
      const valueText = normalizeValue(values.map(value => value.innerText || value.textContent).join(" "));
      const imageAlts = values.flatMap(value => [...value.querySelectorAll("img")].filter(isVisible).map(image => image.alt.trim()));
      const links = values.flatMap(value => [...value.querySelectorAll("a[href]")].filter(isVisible).map(link => ({ text: normalizeText(link.textContent), href: link.href })));
      return { label, valueText, imageAlts, links };
    }).filter(Boolean);
    return { title: document.title, sourceFieldCount: terms.length, visibleFieldCount: rows.length, rows };
  });
  const results = [];
  for (const item of cases) {
    let response;
    try { response = await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 35000 }); }
    catch (error) { results.push({ name: item.name, status: null, available: false, reason: String(error).slice(0, 160) }); continue; }
    let source = await inspectSource();
    if (response?.status() !== 200 || !source) {
      results.push({ name: item.name, status: response?.status() || null, title: await page.title(), available: false, reason: response?.status() === 403 || /验证/.test(await page.title()) ? "source verification page" : "basic-info source unavailable" });
      continue;
    }
    await worker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(candidate => candidate.url === url);
      for (let attempt = 0; attempt < 15; attempt++) {
        try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
        catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    }, page.url());
    await page.waitForFunction(expected => document.querySelectorAll("#raccoon-reader-root .reader-infobox .reader-fact-row").length === expected, source.visibleFieldCount, { timeout: 30000 });
    const comparison = await page.evaluate(sourceRows => {
      const root = document.querySelector("#raccoon-reader-root");
      const normalizeText = value => String(value || "").replace(/\s+/g, " ").trim();
      const normalizeValue = value => normalizeText(value).replace(/\s+/g, "");
      const readOriginal = node => node?.querySelector(".reader-orig-p") || null;
      const readerRows = [...root.querySelectorAll(".reader-infobox .reader-fact-row")].map(row => {
        const key = readOriginal(row.querySelector(".reader-fact-key"));
        const value = readOriginal(row.querySelector(".reader-fact-value"));
        return {
          label: normalizeText(key?.textContent),
          valueText: normalizeValue(value?.textContent),
          imageAlts: [...(value?.querySelectorAll("img") || [])].map(image => image.alt.trim()),
          links: [...(value?.querySelectorAll("a[href]") || [])].map(link => ({ text: normalizeText(link.textContent), href: link.href }))
        };
      });
      const differences = [];
      for (let index = 0; index < Math.max(sourceRows.length, readerRows.length); index++) {
        const source = sourceRows[index], reader = readerRows[index];
        if (!source || !reader) { differences.push({ index, sourceLabel: source?.label || "", readerLabel: reader?.label || "", kind: "row-count" }); continue; }
        const kinds = [];
        if (source.label !== reader.label) kinds.push("label");
        if (source.valueText !== reader.valueText) kinds.push("value");
        if (JSON.stringify(source.imageAlts) !== JSON.stringify(reader.imageAlts)) kinds.push("image-alt");
        if (JSON.stringify(source.links) !== JSON.stringify(reader.links)) kinds.push("links");
        if (kinds.length) differences.push({ index, label: source.label, kinds, sourceLength: source.valueText.length, readerLength: reader.valueText.length, sourceLinks: source.links.length, readerLinks: reader.links.length });
      }
      return { readerFieldCount: readerRows.length, differences, readerLabels: readerRows.map(row => row.label) };
    }, source.rows);
    results.push({ name: item.name, status: response.status(), available: true, sourceFieldCount: source.sourceFieldCount, visibleFieldCount: source.visibleFieldCount, ...comparison });
  }
  return { results, translation: "disabled; original view only" };
}
