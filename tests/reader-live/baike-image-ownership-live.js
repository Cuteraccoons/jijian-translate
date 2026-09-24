async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));
  const url = "https://baike.baidu.com/item/苹果公司";
  const currentPageState = await page.evaluate(() => {
    const path = decodeURIComponent(location.pathname);
    const applePage = location.origin === "https://baike.baidu.com" && path.includes("/item/苹果公司");
    const title = document.title || "";
    return { applePage, articleReady: applePage && !!document.querySelector(".J-lemma-content") && !/验证/.test(title), challenge: applePage && /验证/.test(title) };
  });
  const response = currentPageState.applePage ? null : await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
  const httpStatus = response?.status() ?? (currentPageState.articleReady ? 200 : currentPageState.challenge ? 403 : null);
  const source = await page.evaluate(() => {
    const root = document.querySelector(".J-lemma-content");
    if (!root) return null;
    const canonical = image => {
      try { const parsed = new URL(image.currentSrc || image.src || image.getAttribute("data-src") || "", location.href); return parsed.origin + parsed.pathname; }
      catch (_) { return ""; }
    };
    const allImages = [...root.querySelectorAll("img")];
    const candidates = [...root.querySelectorAll("table")].map(table => ({
      table,
      rows: table.rows.length,
      images: [...table.querySelectorAll("img")].filter(image => image.closest('[class^="para_"],.para') && canonical(image))
    })).filter(item => item.rows >= 2 && item.images.length >= 2 && item.rows <= 80 && tableTextLength(item.table) <= 12000)
      .sort((a, b) => b.images.length - a.images.length);
    const chosen = candidates[0];
    if (!chosen) return { title: document.title, candidateCount: 0 };
    const imageRows = chosen.images.map(image => ({
      src: canonical(image),
      sourceCount: allImages.filter(candidate => canonical(candidate) === canonical(image)).length,
      cellText: image.closest("td,th")?.innerText.replace(/\s+/g, " ").trim() || "",
      paraClass: image.closest('[class^="para_"],.para')?.className || ""
    }));
    return {
      title: document.title,
      candidateCount: candidates.length,
      tableRows: chosen.rows,
      tableTextLength: tableTextLength(chosen.table),
      imageRows,
      uniqueSourceNodes: new Set(chosen.images).size
    };
    function tableTextLength(table) { return String(table.textContent || "").trim().length; }
  });
  const title = await page.title();
  if (httpStatus === 403 || /验证/.test(title)) return { status: httpStatus, title, available: false, reason: "Baidu source verification page; no workaround attempted", translation: "disabled; original view only" };
  if (httpStatus !== 200 || !source?.candidateCount) throw Error(`Apple source table unavailable or changed: HTTP ${httpStatus}, ${JSON.stringify(source)}`);
  const repeatedSourceImages = source.imageRows.filter(image => image.sourceCount === 1);
  if (repeatedSourceImages.length < 2) throw Error(`No suitable single-node table images found: ${JSON.stringify(source)}`);

  await worker.evaluate(async targetUrl => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForSelector("#raccoon-reader-root #reader-content", { timeout: 30000 });
  const output = await page.evaluate(images => {
    const content = document.querySelector("#raccoon-reader-root #reader-content");
    const canonical = image => {
      try { const parsed = new URL(image.currentSrc || image.src || "", location.href); return parsed.origin + parsed.pathname; }
      catch (_) { return ""; }
    };
    const tables = [...content.querySelectorAll(".reader-data-table")];
    const matched = tables.find(table => images.some(expected => [...table.querySelectorAll("img")].some(image => canonical(image) === expected.src)));
    return {
      tableId: matched?.id || "",
      tableRows: matched?.querySelectorAll("tbody tr").length || 0,
      checks: images.map(expected => {
        const matches = [...content.querySelectorAll("img")].filter(image => canonical(image) === expected.src);
        return {
          src: expected.src,
          expectedCell: expected.cellText,
          totalOutputCount: matches.length,
          insideTableCount: matches.filter(image => image.closest(".reader-data-table") === matched).length,
          outsideTableCount: matches.filter(image => image.closest(".reader-data-table") !== matched).length,
          tableCells: matches.map(image => image.closest(".reader-table-cell-pair .reader-orig-p")?.textContent.replace(/\s+/g, " ").trim() || "")
        };
      })
    };
  }, repeatedSourceImages);
  const duplicates = output.checks.filter(check => check.totalOutputCount !== 1 || check.insideTableCount !== 1 || check.outsideTableCount !== 0);
  if (!output.tableId || output.tableRows !== source.tableRows || duplicates.length) throw Error(`Table images were duplicated or table structure changed: ${JSON.stringify({ source, output, duplicates })}`);
  return { status: httpStatus, reusedCurrentTab: currentPageState.articleReady, available: true, source, output, translation: "disabled; original view only" };
}
