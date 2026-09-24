async page => {
  const manualVerificationWaitMs = 0;
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false, readerOutlineCollapsed: false, readerWritingMode: "horizontal" }));
  await page.setViewportSize({ width: 1440, height: 1000 });

  const samples = [
    { name: "苹果公司", url: "https://baike.baidu.com/item/苹果公司" },
    { name: "周杰伦", url: "https://baike.baidu.com/item/周杰伦/129156" },
    { name: "民法典", url: "https://baike.baidu.com/item/中华人民共和国民法典/19435116" }
  ];
  const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
  const results = [];

  for (const sample of samples) {
    let response = null;
    let current = await page.evaluate(expectedUrl => {
      const expected = new URL(expectedUrl), here = new URL(location.href);
      const samePath = here.origin === expected.origin && decodeURIComponent(here.pathname) === decodeURIComponent(expected.pathname);
      const title = document.title || "";
      return { samePath, title, articleReady: samePath && !!document.querySelector(".J-lemma-content") && !/验证|安全检查/.test(title), challenge: /验证|安全检查/.test(title) };
    }, sample.url);
    let reusedCurrentPage = current.articleReady, manualVerified = false;
    let initialStatus = reusedCurrentPage ? 200 : null;
    if (!reusedCurrentPage && current.samePath && current.challenge && manualVerificationWaitMs > 0) {
      try {
        await page.waitForFunction(() => !!document.querySelector(".J-lemma-content") && !/验证|安全检查/.test(document.title || ""), null, { timeout: manualVerificationWaitMs });
        current = await page.evaluate(() => ({ title: document.title || "", articleReady: !!document.querySelector(".J-lemma-content") }));
        manualVerified = current.articleReady;
      } catch { /* Keep the visible verification page available for the user. */ }
    } else if (!reusedCurrentPage) {
      try { response = await page.goto(sample.url, { waitUntil: "domcontentloaded", timeout: 35000 }); }
      catch (error) { results.push({ ...sample, status: null, available: false, reason: error.message.split("\n")[0] }); continue; }
      initialStatus = response?.status() || null;
      current = await page.evaluate(() => ({ title: document.title || "", articleReady: !!document.querySelector(".J-lemma-content"), challenge: /验证|安全检查/.test(document.title || "") }));
      if ((!current.articleReady || current.challenge || initialStatus !== 200) && manualVerificationWaitMs > 0) {
        try {
          await page.waitForFunction(() => !!document.querySelector(".J-lemma-content") && !/验证|安全检查/.test(document.title || ""), null, { timeout: manualVerificationWaitMs });
          current = await page.evaluate(() => ({ title: document.title || "", articleReady: !!document.querySelector(".J-lemma-content") }));
          manualVerified = current.articleReady;
        } catch { /* User can solve the challenge in the visible browser and rerun. */ }
      }
    }
    const title = current.title || await page.title();
    if ((!current.articleReady && !reusedCurrentPage) || (!manualVerified && initialStatus !== 200 && !reusedCurrentPage) || /验证|安全检查/.test(title)) {
      results.push({ ...sample, status: initialStatus, title, available: false, reason: "source verification or network error; no workaround attempted" });
      continue;
    }
    try { await page.waitForSelector(".J-lemma-content", { timeout: 12000 }); }
    catch { results.push({ ...sample, status: initialStatus, title, available: false, reason: "article content container not found" }); continue; }

    const source = await page.evaluate(() => {
      // Baidu's facts block can live beside .J-lemma-content inside the exact
      // main container used by the extension's Baike reader extraction.
      const root = document.querySelector('[class^="mainContent_"],.main-content') || document.querySelector(".J-lemma-content");
      const navigation = [...root.querySelectorAll('[class^="catalog_"],[class^="catalogWrapper_"],.lemma-catalog')]
        .filter(node => !node.parentElement?.closest('[class^="catalogWrapper_"]'));
      const headings = [...root.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading'][aria-level]")]
        .filter(node => !node.closest('[class^="catalog_"],[class^="catalogWrapper_"],.lemma-catalog,[role="navigation"]'))
        .filter(node => !node.closest("#J-lemma-starmap,[class*='starmap']"))
        .map(node => {
          const ancestors = [];
          for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) if (parent.id) ancestors.push(parent.id);
          return { text: node.textContent.replace(/\s+/g, " ").trim(), tag: node.tagName, level: Number(node.tagName.match(/[1-6]/)?.[0] || node.getAttribute("aria-level") || 2), id: node.id, name: node.getAttribute("name"), dataIndex: node.getAttribute("data-index"), ancestorIds: ancestors };
        }).filter(item => item.text.length > 1);
      const links = navigation.flatMap(container => [...container.querySelectorAll("a[href]")]).map(link => {
        const id = (() => { try { return decodeURIComponent(new URL(link.href).hash.slice(1)); } catch { return ""; } })();
        return { text: link.textContent.replace(/\s+/g, " ").trim(), id, targetExists: !!id && (!!root.querySelector(`[id="${CSS.escape(id)}"]`) || !![...root.querySelectorAll("a[name]")].find(anchor => anchor.name === id)) };
      });
      return { title: document.title, headingCount: headings.length, headings, navigationCount: navigation.length, tocLinkCount: links.length, unresolvedTocLinks: links.filter(link => !link.targetExists).slice(0, 8), tocSamples: links.slice(0, 6) };
    });

    await worker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(item => item.url === url);
      if (!tab) throw Error("Source tab not found");
      for (let attempt = 0; attempt < 15; attempt++) {
        try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
        catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    }, page.url());
    await page.waitForSelector("#raccoon-reader-root #reader-content", { timeout: 30000 });
    const reader = await page.evaluate(() => {
      const root = document.querySelector("#raccoon-reader-root"), content = root.querySelector("#reader-content");
      const items = [...root.querySelectorAll(".reader-outline-item")];
      const headings = items.map(item => ({ text: item.querySelector(".reader-outline-label")?.textContent.replace(/\s+/g, " ").trim(), level: Number(item.dataset.headingLevel), id: item.dataset.targetId, exists: !!root.querySelector(`#${CSS.escape(item.dataset.targetId)}`) }));
      return { headingCount: headings.length, headings, missingTargets: headings.filter(item => !item.exists), navigationNodeCount: content.querySelectorAll('[class^="catalog_"],[class^="catalogWrapper_"],.lemma-catalog,[role="navigation"]').length, headingPairs: [...content.querySelectorAll(".reader-paragraph-pair[data-heading='true']")].map(pair => ({ text: pair.querySelector(".reader-orig-p")?.textContent.replace(/\s+/g, " ").trim(), level: Number(pair.dataset.headingLevel), id: pair.id })) };
    });

    const clickChecks = [];
    for (const index of [...new Set([0, Math.floor((reader.headings.length - 1) / 2), reader.headings.length - 1])].filter(index => index >= 0)) {
      const item = reader.headings[index], row = page.locator(".reader-outline-item").nth(index);
      const rect = await row.boundingBox();
      await row.click({ position: { x: Math.max(1, rect.width - 5), y: rect.height / 2 } });
      let geometry = null, previousTop = null, stableFrames = 0;
      for (let attempt = 0; attempt < 32 && stableFrames < 3; attempt++) {
        await page.waitForTimeout(80);
        geometry = await page.evaluate(id => {
          const area = document.querySelector("#reader-scroll-area"), target = document.getElementById(id), a = area.getBoundingClientRect(), t = target.getBoundingClientRect();
          return { top: t.top - a.top, bottom: t.bottom - a.top, areaHeight: a.height };
        }, item.id);
        stableFrames = previousTop !== null && Math.abs(geometry.top - previousTop) < 1 ? stableFrames + 1 : 0;
        previousTop = geometry.top;
      }
      const passed = item.exists && geometry.top >= -2 && geometry.top < geometry.areaHeight - 40 && stableFrames >= 3;
      clickChecks.push({ index, text: item.text, level: item.level, targetId: item.id, geometry, stableFrames, passed });
    }

    const sourceBodyHeadings = source.headings.filter(item => item.level > 1);
    const sourceLevels = sourceBodyHeadings.reduce((counts, item) => ({ ...counts, [item.level]: (counts[item.level] || 0) + 1 }), {});
    const readerLevels = reader.headings.reduce((counts, item) => ({ ...counts, [item.level]: (counts[item.level] || 0) + 1 }), {});
    const mismatches = [];
    for (let index = 0; index < Math.max(sourceBodyHeadings.length, reader.headings.length); index++) {
      const sourceHeading = sourceBodyHeadings[index], readerHeading = reader.headings[index];
      if (!sourceHeading || !readerHeading || normalize(sourceHeading.text) !== normalize(readerHeading.text) || sourceHeading.level !== readerHeading.level) {
        mismatches.push({ index, source: sourceHeading ? { text: sourceHeading.text, level: sourceHeading.level, id: sourceHeading.id, ancestorIds: sourceHeading.ancestorIds } : null, reader: readerHeading ? { text: readerHeading.text, level: readerHeading.level, id: readerHeading.id } : null });
      }
    }
    results.push({ ...sample, status: manualVerified ? 200 : (initialStatus || 200), initialStatus, manualVerified, reusedCurrentPage, available: true, source: { ...source, headingLevels: sourceLevels }, reader: { ...reader, headingLevels: readerLevels }, mismatches: mismatches.slice(0, 12), clickChecks, translation: "disabled; original view only" });
  }
  return { results };
}
