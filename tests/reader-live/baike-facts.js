async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));

  const longLabel = "Long-link-name-for-line-wrapping-check-".repeat(4);
  const prose = "This self-authored fixture checks how labels and values stay paired when the source definition list contains wrappers, multiple values, and hidden placeholders. ".repeat(2);
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Fact pairing fixture</title></head><body><main class="J-lemma-content"><h1>字段配对样例</h1><p>${prose}</p><div class="basicInfo_fixture J-basic-info"><dl>
    <div class="fact"><dt>本    名</dt><dd>林 夏</dd></div>
    <div class="fact"><dt>Stage name</dt><dd><a href="https://example.test/person/mira">Mira Li</a></dd></div>
    <div class="fact"><dt>代表作品</dt><dd>《北风》</dd><dd><a href="https://example.test/work/river">《河声》</a></dd></div>
    <div class="fact"><dt>出生地</dt><div class="value-shell"><dd><a href="https://example.test/place/lake">湖城</a><span>（虚构城市）</span></dd></div></div>
    <div class="fact"><dt>官方网站</dt><dd><a href="https://example.test/long-profile">${longLabel}</a></dd></div>
    <div class="fact"><dt>空值字段</dt><dd>   </dd></div>
    <div class="fact"><dt>下一字段</dt><dd>保持原配对</dd></div>
    <div class="fact" style="display:none"><dt>隐藏占位</dt><dd>不可见占位值</dd></div>
    <div class="fact"><dt>折叠值</dt><dd style="display:none">不可见字段值</dd></div>
    <div class="fact"><dt>多行说明</dt><dd>第一行<br>第二行</dd></div>
  </dl></div><p class="para">邻近正文仍然是一段普通正文，不属于基本信息。</p></main></body></html>`;
  await page.route("https://baike.baidu.com/item/Fact_Pairing_Fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  const response = await page.goto("https://baike.baidu.com/item/Fact_Pairing_Fixture", { waitUntil: "domcontentloaded" });
  const source = await page.evaluate(() => {
    const root = document.querySelector(".J-basic-info");
    return {
      fieldCount: root.querySelectorAll("dt").length,
      visibleHiddenPairs: [...root.querySelectorAll("dt")].filter(term => getComputedStyle(term.parentElement).display === "none").length,
      adjacentValueCount: [...root.querySelectorAll("dt")].filter(term => term.nextElementSibling?.tagName === "DD").length,
      wrappedValueCount: [...root.querySelectorAll("dt")].filter(term => term.nextElementSibling?.tagName !== "DD" && term.parentElement.querySelector("dd")).length
    };
  });

  await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === url);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForSelector("#raccoon-reader-root .reader-infobox", { timeout: 25000 });
  const inspect = () => page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root");
    const rows = [...root.querySelectorAll(".reader-infobox .reader-fact-row")];
    const original = node => node?.querySelector(".reader-orig-p")?.innerText.replace(/\s+/g, " ").trim() || "";
    return {
      headings: [...root.querySelectorAll(".reader-infobox .reader-table-heading")].map(node => node.innerText.trim()),
      rows: rows.map(row => ({
        label: original(row.querySelector(".reader-fact-key")),
        value: original(row.querySelector(".reader-fact-value")),
        links: [...row.querySelectorAll(".reader-fact-value .reader-orig-p a[href]")].map(link => ({ text: link.textContent.trim(), href: link.href })),
        breaks: row.querySelectorAll(".reader-fact-value .reader-orig-p br").length,
        valueWidth: row.querySelector(".reader-fact-value .reader-orig-p")?.clientWidth || 0,
        valueScrollWidth: row.querySelector(".reader-fact-value .reader-orig-p")?.scrollWidth || 0
      })),
      factLayout: (() => {
        const list = root.querySelector(".reader-baike-infobox .reader-fact-list");
        const factRows = [...(list?.querySelectorAll(".reader-fact-row") || [])];
        return {
          display: list ? getComputedStyle(list).display : "missing",
          columns: list ? getComputedStyle(list).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0,
          contentWidth: root.querySelector("#reader-content").clientWidth,
          cards: factRows.map(row => {
            const rect = row.getBoundingClientRect();
            const key = row.querySelector(".reader-fact-key").getBoundingClientRect();
            const value = row.querySelector(".reader-fact-value").getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, keyX: key.x, valueX: value.x };
          })
        };
      })(),
      bodyContainsNearby: root.querySelector("#reader-content")?.textContent.includes("邻近正文仍然是一段普通正文"),
      content: { width: root.querySelector("#reader-content").clientWidth, scrollWidth: root.querySelector("#reader-content").scrollWidth }
    };
  });
  await page.waitForFunction(() => document.querySelectorAll("#raccoon-reader-root .reader-infobox .reader-fact-row").length > 0, { timeout: 10000 });
  await page.setViewportSize({ width: 390, height: 900 });
  const narrow = await inspect();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wide = await inspect();
  const labels = narrow.rows.map(row => row.label);
  const works = narrow.rows.find(row => row.label === "代表作品");
  const wrapped = narrow.rows.find(row => row.label === "出生地");
  const long = narrow.rows.find(row => row.label === "官方网站");
  if (response?.status() !== 200) throw Error(`Fixture HTTP status ${response?.status()}`);
  if (source.fieldCount !== 10 || source.visibleHiddenPairs !== 1 || source.wrappedValueCount !== 1) throw Error(`Fixture source shape changed: ${JSON.stringify(source)}`);
  if (narrow.headings.length !== 1 || narrow.headings[0] !== "基本信息") throw Error(`Basic-info section is missing or duplicated: ${JSON.stringify(narrow.headings)}`);
  if (narrow.rows.length !== 7 || labels.join("|") !== "本名|Stage name|代表作品|出生地|官方网站|下一字段|多行说明") throw Error(`Field rows were lost, duplicated, or paired out of order: ${JSON.stringify(narrow.rows)}`);
  if (!works || works.links.length !== 1 || !works.value.includes("《北风》") || !works.value.includes("《河声》")) throw Error(`Multiple DD values or links were lost: ${JSON.stringify(works)}`);
  if (!wrapped || wrapped.value !== "湖城（虚构城市）" || wrapped.links.length !== 1) throw Error(`Wrapped value was not paired with its label: ${JSON.stringify(wrapped)}`);
  if (!long || long.value.length < 120 || long.valueWidth <= 0 || long.valueScrollWidth > long.valueWidth + 1) throw Error(`Long value does not wrap within its field: ${JSON.stringify(long)}`);
  if (narrow.rows.find(row => row.label === "下一字段")?.value !== "保持原配对") throw Error("Empty field consumed the next field's value");
  if (narrow.rows.find(row => row.label === "多行说明")?.breaks < 1) throw Error("Line break inside a value was lost");
  if (narrow.content.scrollWidth > narrow.content.width + 1 || wide.content.scrollWidth > wide.content.width + 1) throw Error(`Basic-info content caused page overflow: ${JSON.stringify({ narrow: narrow.content, wide: wide.content })}`);
  if (narrow.factLayout.contentWidth >= 700 || narrow.factLayout.display === "grid" || narrow.factLayout.cards.some((card, index, cards) => index > 0 && (card.x !== cards[0].x || card.y <= cards[index - 1].y))) throw Error(`Narrow facts should remain a single vertical list: ${JSON.stringify(narrow.factLayout)}`);
  if (wide.factLayout.contentWidth < 700 || wide.factLayout.display !== "grid" || wide.factLayout.columns !== 2) throw Error(`Wide Baidu facts should use two cards per row: ${JSON.stringify(wide.factLayout)}`);
  if (wide.factLayout.cards.length !== 7 || wide.factLayout.cards.some((card, index, cards) => card.valueX <= card.keyX || (index % 2 === 1 && (Math.abs(card.y - cards[index - 1].y) > 2 || card.x <= cards[index - 1].x)))) throw Error(`Wide facts should pair label/value columns inside left/right cards: ${JSON.stringify(wide.factLayout)}`);
  await page.unrouteAll();
  return { status: response?.status(), source, narrow, wide, translation: "disabled; original view only" };
}
