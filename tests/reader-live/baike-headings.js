async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({
    readerView: "orig",
    autoTranslateEnabled: false,
    readerOutlineCollapsed: false,
    readerOutlineWidth: 230,
    readerWritingMode: "horizontal"
  }));
  await page.setViewportSize({ width: 1080, height: 900 });

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>目录映射样例_百度百科</title></head><body>
    <main class="J-lemma-content">
      <h1>目录映射样例</h1>
      <p>这段自有 fixture 引言用于保证测试容器被识别为文章正文，并验证大纲目标的稳定映射、重复标题和目录锚点跳转行为。</p>
      <ul class="para_list_fixture"><li><strong>创立背景</strong></li><li><strong>成立合伙企业</strong></li><li>保留在正文中的普通项目</li></ul>
      <nav class="catalog_fixture" aria-label="源目录"><a href="#first-section">目录中第一节</a><a href="#missing-source-target">不存在的目标</a></nav>
      <h2 id="first-section">第一节</h2>
      <p>第一节的正文用于让第一条大纲有可见目标，并为后续章节的滚动定位提供足够内容。</p>
      <p>跳转链接：<a href="#wrapped-section">打开包装标题所在章节</a></p>
      <section id="wrapped-section" data-index="section-2">
        <h2 id="wrapped-heading" data-index="heading-2">标题外包装 ID</h2>
        <p>包装标题后的内容用于验证原网页指向祖先容器 ID 时，阅读器能定位到对应标题。</p>
        <h3 id="nested-heading" aria-level="3">三级标题</h3>
        <p>三级标题之后保留一段足够长的正文，避免滚动测试目标太短而被相邻段落挤出视口。</p>
        <h3 id="long-heading">很长的三级标题，用于测试左侧大纲窄宽布局时多行标题、完整文字和激活状态下划线都不会被容器裁切</h3>
        <p>长标题后面的自有正文内容提供稳定高度。</p>
      </section>
      <h2 id="duplicate-one">同名章节</h2>
      <p>第一处同名章节正文，应该能独立定位到第一条同名标题，而不是总跳到最前面。</p>
      <div style="height:480px"></div>
      <h2 id="duplicate-two">同名章节</h2>
      <p>第二处同名章节正文，应该保留为另一条大纲目标。</p>
      <h2 id="last-section">末尾章节</h2>
      <p>末尾内容为最后一个目标提供足够滚动空间。</p>
      <nav class="catalog_fixture"><a href="#last-section">另一个目录项</a></nav>
    </main></body></html>`;
  await page.route("https://baike.baidu.com/item/Heading_Mapping_Fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  const response = await page.goto("https://baike.baidu.com/item/Heading_Mapping_Fixture", { waitUntil: "domcontentloaded" });
  const source = await page.evaluate(() => {
    const root = document.querySelector(".J-lemma-content");
    return {
      title: document.title,
      headings: [...root.querySelectorAll("h1,h2,h3,h4")].map(node => ({
        text: node.textContent.trim(),
        tag: node.tagName,
        level: Number(node.tagName.slice(1)),
        id: node.id,
        name: node.getAttribute("name"),
        dataIndex: node.getAttribute("data-index"),
        ancestorIds: [...(function* () { for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) if (parent.id) yield parent.id; })()]
      })),
      sourceCatalogItems: root.querySelectorAll("nav.catalog_fixture a").length
    };
  });

  await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === url);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForSelector("#raccoon-reader-root #reader-content", { timeout: 25000 });

  const initial = await page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root");
    const content = root.querySelector("#reader-content");
    const items = [...root.querySelectorAll(".reader-outline-item")];
    return {
      title: root.querySelector(".reader-title")?.textContent.trim(),
      outline: items.map(item => ({ text: item.querySelector(".reader-outline-label")?.textContent.trim(), level: Number(item.dataset.headingLevel), id: item.dataset.targetId, exists: !!root.querySelector(`#${CSS.escape(item.dataset.targetId)}`) })),
      sourceNavigationLeaked: content.textContent.includes("目录中第一节") || content.textContent.includes("另一个目录项"),
      contentHeadings: [...content.querySelectorAll(".reader-paragraph-pair[data-heading='true']")].map(pair => ({ text: pair.querySelector(".reader-orig-p")?.textContent.trim(), id: pair.id, level: Number(pair.dataset.headingLevel) })),
      listHeadingRows: [...content.querySelectorAll(".reader-paragraph-pair[data-heading='true']")].filter(pair => ["创立背景","成立合伙企业"].includes(pair.querySelector(".reader-orig-p")?.textContent.trim())).map(pair => ({ text:pair.querySelector(".reader-orig-p")?.textContent.trim(), level:Number(pair.dataset.headingLevel), listWrapper:!!pair.closest(".reader-list-block") })),
      ordinaryParaListItems: [...content.querySelectorAll(".reader-paragraph-pair")].filter(node => node.innerText.trim()==="保留在正文中的普通项目").length,
      duplicateListHeadingInWrapper: ["创立背景","成立合伙企业"].some(label => [...content.querySelectorAll(".reader-paragraph-pair")].some(node => node.innerText.trim()===label&&!node.matches("[data-heading='true']"))),
      articleRect: root.querySelector("#reader-scroll-area").getBoundingClientRect().toJSON(),
      outlineRect: root.querySelector("#reader-outline-panel").getBoundingClientRect().toJSON(),
      outlineViewRect: root.querySelector("[data-reader-nav-view='outline']").getBoundingClientRect().toJSON(),
      rowMetrics: items.map(item => {
        const row = item.getBoundingClientRect(), label = item.querySelector(".reader-outline-label"), view = root.querySelector("[data-reader-nav-view='outline']").getBoundingClientRect();
        return { text: label?.textContent.trim(), width: row.width, scrollWidth: item.scrollWidth, height: row.height, gutter: row.left - view.left, rightInset: view.right - row.right, labelHeight: label?.getBoundingClientRect().height, labelScrollHeight: label?.scrollHeight, labelClientHeight: label?.clientHeight, labelOverflowY: getComputedStyle(label).overflowY };
      })
    };
  });

  const clickChecks = [];
  const targets = [
    { text: "第一节", occurrence: 0 },
    { text: "三级标题", occurrence: 0 },
    { text: source.headings.find(heading => heading.id === "long-heading")?.text, occurrence: 0 },
    { text: "同名章节", occurrence: 0 },
    { text: "同名章节", occurrence: 1 },
    { text: "末尾章节", occurrence: 0 }
  ];
  for (const item of targets) {
    const rows = page.locator(".reader-outline-item");
    const rowTexts = await rows.locator(".reader-outline-label").allTextContents();
    const matches = rowTexts.map((text, index) => ({ text: text.trim(), index })).filter(row => row.text === item.text);
    const match = matches[item.occurrence];
    const count = matches.length;
    if (!match) { clickChecks.push({ label: item.text, occurrence: item.occurrence, count, passed: false, reason: "missing outline row" }); continue; }
    const selection = rows.nth(match.index);
    const targetId = await selection.getAttribute("data-target-id");
    const rowRect = await selection.boundingBox();
    await selection.click({ position: { x: Math.max(1, rowRect.width - 5), y: rowRect.height / 2 } });
    let geometry = null, previousTop = null, stableFrames = 0;
    for (let attempt = 0; attempt < 32 && stableFrames < 3; attempt++) {
      await page.waitForTimeout(80);
      geometry = await page.evaluate(id => {
        const area = document.querySelector("#reader-scroll-area"), target = document.getElementById(id);
        const a = area.getBoundingClientRect(), t = target.getBoundingClientRect();
        return { top: t.top - a.top, bottom: t.bottom - a.top, targetHeight: t.height, areaHeight: a.height, scrollTop: area.scrollTop };
      }, targetId);
      stableFrames = previousTop !== null && Math.abs(geometry.top - previousTop) < 1 ? stableFrames + 1 : 0;
      previousTop = geometry.top;
    }
    const expectedText = item.text;
    const actual = await page.locator(`#${targetId} .reader-orig-p`).first().innerText();
    const labelMetrics = await selection.locator(".reader-outline-label").evaluate(node => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, overflowY: getComputedStyle(node).overflowY, textDecorationLine: getComputedStyle(node).textDecorationLine }));
    const passed = actual.trim() === expectedText.trim() && geometry.top >= -2 && geometry.top < geometry.areaHeight - 40 && stableFrames >= 3 && labelMetrics.scrollHeight <= labelMetrics.clientHeight + 1 && labelMetrics.overflowY === "visible";
    clickChecks.push({ label: item.text, occurrence: item.occurrence, count, targetId, actual: actual.trim(), geometry, stableFrames, labelMetrics, passed });
  }

  const wrapperLink = page.locator("#reader-content a[href$='#wrapped-section']");
  const wrapperLinkCount = await wrapperLink.count();
  let wrapperAnchor = null;
  if (wrapperLinkCount) {
    await wrapperLink.click();
    await page.waitForTimeout(400);
    wrapperAnchor = await page.evaluate(() => {
      const area = document.querySelector("#reader-scroll-area");
      const heading = [...document.querySelectorAll("#reader-content .reader-structural-heading.reader-orig-p")].find(node => node.textContent.trim() === "标题外包装 ID");
      const target = heading?.closest(".reader-paragraph-pair");
      if (!area || !target) return { exists: !!target, url: location.href };
      return { exists: true, targetId: target.id, top: target.getBoundingClientRect().top - area.getBoundingClientRect().top, areaHeight: area.clientHeight, scrollTop: area.scrollTop, url: location.href };
    });
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => document.querySelector("#raccoon-reader-root")?.style.setProperty("--reader-outline-width", "330px"));
  await page.waitForTimeout(250);
  const wide = await page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root"), view = root.querySelector("[data-reader-nav-view='outline']");
    const viewRect = view.getBoundingClientRect();
    const rows = [...root.querySelectorAll(".reader-outline-item")].map(item => {
      const rect = item.getBoundingClientRect(), label = item.querySelector(".reader-outline-label");
      return { text: label.textContent.trim(), width: rect.width, scrollWidth: item.scrollWidth, gutter: rect.left - viewRect.left, rightInset: viewRect.right - rect.right, labelScrollHeight: label.scrollHeight, labelClientHeight: label.clientHeight };
    });
    return { viewWidth: viewRect.width, rows };
  });
  const wideRowsFit = wide.rows.every(row => row.gutter >= 0 && row.rightInset <= 16 && row.scrollWidth <= row.width + 6);
  const wideLongHeading = wide.rows.find(row => row.text === source.headings.find(heading => heading.id === "long-heading")?.text);
  const wideLongHeadingFullyVisible = !!wideLongHeading && wideLongHeading.labelScrollHeight <= wideLongHeading.labelClientHeight + 1;
  const wideEndRowIndex = wide.rows.findIndex(row => row.text === "末尾章节");
  let wideEndClick = null;
  if (wideEndRowIndex >= 0) {
    const row = page.locator(".reader-outline-item").nth(wideEndRowIndex), id = await row.getAttribute("data-target-id"), rect = await row.boundingBox();
    await row.click({ position: { x: Math.max(1, rect.width - 5), y: rect.height / 2 } });
    await page.waitForTimeout(500);
    wideEndClick = await page.evaluate(targetId => {
      const area = document.querySelector("#reader-scroll-area"), target = document.getElementById(targetId), a = area.getBoundingClientRect();
      return { targetId, text: target?.querySelector(".reader-orig-p")?.textContent.trim(), top: target?.getBoundingClientRect().top - a.top, areaHeight: a.height };
    }, id);
  }
  const expectedHeadings = source.headings.filter(heading => heading.level >= 2);
  const actualHeadings = initial.contentHeadings.filter(heading => !["创立背景","成立合伙企业"].includes(heading.text));
  const headingOrderMatches = expectedHeadings.length === actualHeadings.length && expectedHeadings.every((heading, index) => heading.text === actualHeadings[index]?.text && heading.level === actualHeadings[index]?.level);
  const allOutlineTargetsExist = initial.outline.length === actualHeadings.length + 2 && initial.outline.every(item => item.exists);
  const shortListHeadingsRecognized = initial.listHeadingRows.map(item => item.text).join("|") === "创立背景|成立合伙企业" && initial.listHeadingRows.every(item => item.level === 3 && !item.listWrapper) && initial.ordinaryParaListItems === 1 && !initial.duplicateListHeadingInWrapper;
  const longHeading = initial.rowMetrics.find(row => row.text === source.headings.find(heading => heading.id === "long-heading")?.text);
  const narrowRowsFit = initial.rowMetrics.every(row => row.gutter >= 0 && row.rightInset <= 16 && row.scrollWidth <= row.width + 6);
  const longHeadingFullyVisible = !!longHeading && longHeading.labelScrollHeight <= longHeading.labelClientHeight + 1 && longHeading.labelOverflowY === "visible";
  const clicksPass = clickChecks.length === targets.length && clickChecks.every(check => check.passed) && new Set(clickChecks.filter(check => check.label === "同名章节").map(check => check.targetId)).size === 2;
  const wrapperAnchorPass = !!wrapperAnchor?.exists && wrapperAnchor.top >= -2 && wrapperAnchor.top < wrapperAnchor.areaHeight - 40 && !wrapperAnchor.url.endsWith("#wrapped-section");
  const assertions = { headingOrderMatches, allOutlineTargetsExist, shortListHeadingsRecognized, sourceNavigationExcluded: !initial.sourceNavigationLeaked, clicksPass, wrapperAnchorPass, narrowRowsFit, longHeadingFullyVisible, wideRowsFit, wideLongHeadingFullyVisible, wideEndClickPass: wideEndClick?.text === "末尾章节" && wideEndClick.top >= -2 && wideEndClick.top < wideEndClick.areaHeight - 40 };
  const result = { status: response?.status(), source, initial, clickChecks, wrapperLinkCount, wrapperAnchor, wide, wideEndClick, assertions, translation: "disabled; original view only" };
  const failed = Object.entries(assertions).filter(([, passed]) => !passed);
  if (response?.status() !== 200 || failed.length) throw Error(`Baike heading mapping assertions failed: ${JSON.stringify({ failed, result })}`);
  await page.unrouteAll();
  return result;
}
