async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  const url = page.url();
  if (!url.startsWith("https://baike.baidu.com/")) throw Error("Open a Baidu Baike article in the current tab first");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));

  let reader = await page.locator("#raccoon-reader-root").count();
  if (!reader) {
    if (!(await page.locator(".J-basic-info,.basic-info").count())) throw Error("The current Baidu page has no basic-info source block; complete any visible verification first");
    await worker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(item => item.url === url);
      if (!tab) throw Error("Current Baidu tab was not found");
      for (let attempt = 0; attempt < 15; attempt++) {
        try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
        catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    }, url);
  }
  await page.waitForSelector("#raccoon-reader-root .reader-baike-infobox .reader-fact-row", { timeout: 25000 });

  const inspect = () => page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root");
    const content = root.querySelector("#reader-content");
    const section = content.querySelector(".reader-baike-infobox");
    const list = section?.querySelector(".reader-fact-list");
    const rows = [...(list?.querySelectorAll(".reader-fact-row") || [])];
    return {
      title: root.querySelector(".reader-title")?.textContent.trim(),
      width: content.clientWidth,
      scrollWidth: content.scrollWidth,
      display: list ? getComputedStyle(list).display : "missing",
      columns: list ? getComputedStyle(list).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0,
      rows: rows.length,
      labels: rows.slice(0, 4).map(row => row.querySelector(".reader-fact-key .reader-orig-p")?.textContent.trim()),
      cards: rows.slice(0, 4).map(row => {
        const rect = row.getBoundingClientRect();
        const key = row.querySelector(".reader-fact-key").getBoundingClientRect();
        const value = row.querySelector(".reader-fact-value").getBoundingClientRect();
        return { x: rect.x, y: rect.y, keyX: key.x, valueX: value.x, width: rect.width };
      })
    };
  });

  await page.setViewportSize({ width: 390, height: 900 });
  const narrow = await inspect();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wide = await inspect();
  if (narrow.rows < 1 || wide.rows !== narrow.rows) throw Error("Live facts disappeared or changed count across widths: " + JSON.stringify({ narrow, wide }));
  if (narrow.width >= 700 || narrow.display === "grid" || narrow.scrollWidth > narrow.width + 1) throw Error("Narrow live facts should remain one column without overflow: " + JSON.stringify(narrow));
  if (wide.width < 700 || wide.display !== "grid" || wide.columns !== 2 || wide.scrollWidth > wide.width + 1) throw Error("Wide live facts should use two paired cards per row without overflow: " + JSON.stringify(wide));
  if (wide.cards.length < 2 || wide.cards[0].valueX <= wide.cards[0].keyX || wide.cards[1].x <= wide.cards[0].x || Math.abs(wide.cards[1].y - wide.cards[0].y) > 2) throw Error("Wide live facts did not form left/right label-value cards: " + JSON.stringify(wide.cards));

  const first = page.locator(".reader-outline-item").filter({ hasText: "基本信息" }).first();
  let firstHeading = null;
  if (await first.count()) {
    const targetId = await first.getAttribute("data-target-id");
    await first.click();
    firstHeading = await page.evaluate(id => {
      const area = document.querySelector("#reader-scroll-area"), target = document.getElementById(id);
      return target ? { text: target.innerText.trim(), top: target.getBoundingClientRect().top - area.getBoundingClientRect().top, areaHeight: area.clientHeight } : null;
    }, targetId);
  }
  return { status: 200, narrow, wide, firstHeading, translation: "disabled; original view only" };
}
