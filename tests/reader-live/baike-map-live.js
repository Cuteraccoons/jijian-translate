async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));
  const url = "https://baike.baidu.com/item/清华大学/111764";
  let response;
  try { response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 }); }
  catch (error) { return { status: null, available: false, reason: String(error).slice(0, 180), translation: "disabled; original view only" }; }
  const source = await page.evaluate(() => {
    const root = document.querySelector(".J-lemma-content");
    if (!root) return null;
    const maps = [...root.querySelectorAll('[data-module-type="map"]')];
    return {
      title: document.title,
      maps: maps.map(node => ({
        title: (node.querySelector('[class^="addressTitle_"]')?.textContent || "").replace(/\s+/g, " ").trim(),
        address: (node.querySelector('[class^="addressDetail_"]')?.textContent || "").replace(/\s+/g, " ").trim(),
        href: node.querySelector('[class^="addressLink_"][href]')?.href || "",
        tileCount: [...node.querySelectorAll("img")].filter(image => /\/tile\//.test(image.currentSrc || image.src)).length
      }))
    };
  });
  if (response?.status() === 403 || /验证/.test(await page.title())) return { status: response?.status() || 403, available: false, reason: "Baidu source verification page; no workaround attempted", translation: "disabled; original view only" };
  if (response?.status() !== 200 || !source) return { status: response?.status() || null, available: false, reason: "article content unavailable", translation: "disabled; original view only" };
  if (source.maps.length === 0) return { status: response.status(), available: false, reason: "no map modules on current source page", translation: "disabled; original view only" };
  await worker.evaluate(async targetUrl => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl);
    if (!tab) throw Error("Current Baidu article tab not found");
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForFunction(expected => document.querySelectorAll("#raccoon-reader-root .reader-baike-map-card").length === expected, source.maps.length, { timeout: 30000 });
  const reader = await page.evaluate(() => ({
    maps: [...document.querySelectorAll("#raccoon-reader-root .reader-baike-map-card")].map(card => ({
      title: card.querySelector("h3")?.textContent.trim() || "",
      address: card.querySelector("p")?.textContent.trim() || "",
      linkText: card.querySelector("a")?.textContent.trim() || "",
      link: card.querySelector("a")?.href || "",
      embedded: !!card.querySelector("iframe,script,img,canvas,video,audio")
    })),
    contentWidth: document.querySelector("#reader-content")?.clientWidth || 0,
    contentScrollWidth: document.querySelector("#reader-content")?.scrollWidth || 0
  }));
  const differences = source.maps.map((item, index) => {
    const output = reader.maps[index];
    const expectedLabel = item.href ? "在百度地图中查看" : "在原网页查看地图";
    return {
      index,
      titleMatches: item.title ? item.title === output?.title : output?.title === "地图位置",
      addressMatches: item.address ? item.address === output?.address : output?.address === "地图交互内容未嵌入阅读模式",
      linkLabelMatches: output?.linkText === expectedLabel,
      linkIsSafe: output?.link.startsWith("https://api.map.baidu.com/marker?") || output?.link === url,
      mapTilesOmitted: output?.embedded === false
    };
  });
  const failed = differences.some(item => !item.titleMatches || !item.addressMatches || !item.linkLabelMatches || !item.linkIsSafe || !item.mapTilesOmitted);
  if (failed || reader.maps.length !== source.maps.length || reader.contentScrollWidth > reader.contentWidth + 1) throw Error("Baidu map fallback differs from source data or overflows: " + JSON.stringify({ source, reader, differences }));
  return { status: response.status(), available: true, source, reader, differences, translation: "disabled; original view only" };
}
