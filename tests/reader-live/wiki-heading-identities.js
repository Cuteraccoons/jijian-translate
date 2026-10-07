async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false, readerOutlineCollapsed: false, readerOutlineWidth: 270, readerWritingMode: "horizontal" }));
  await page.setViewportSize({ width: 1280, height: 900 });
  const gapParagraphs = Array.from({ length: 18 }, (_, index) => '<p>Additional source prose for stable scroll positioning in the multilingual heading fixture, block ' + (index + 1) + '. The translated column stays disabled.</p>').join('');
  const tailParagraphs = Array.from({ length: 16 }, (_, index) => '<p>More source prose after the final heading keeps each target independently scrollable, paragraph ' + (index + 1) + '.</p>').join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>W03 Heading Fixture</title></head><body>
    <nav id="vector-toc"><a href="#History">侧栏目录不应进入正文</a></nav>
    <div id="mw-content-text"><div class="mw-parser-output">
      <h1>Multilingual heading fixture</h1>
      <h2><span class="mw-headline" id="History">History</span><span class="mw-editsection">[<a href="#edit">edit</a>]</span></h2>
      <p>There is enough article text before the next heading. <a href="#Overview_2">Jump to the second Overview</a>. <a href="#%E6%97%A5%E6%9C%AC%E8%AA%9E_%E7%AF%80">Jump to Japanese</a>. <a href="#wrapper-anchor">Jump to wrapper heading</a>.</p>
      <h2 id="Overview"><span class="mw-headline">Overview</span><span class="mw-editsection">[edit]</span></h2>
      <p>First same-named section.</p>
      <h3 id="中文_层级"><span class="mw-headline">中文标题</span></h3>
      <p>Chinese nested section.</p>
      <h4 id="日本語_節"><span class="mw-headline">日本語の節</span><span class="mw-editsection">[edit]</span></h4>
      <p>Japanese nested section.</p>
      <div class="mw-heading mw-heading2" id="wrapper-anchor"><h2><span class="mw-headline" id="Wrapped_identity">Wrapped section</span></h2></div>
      <p>Heading identity is on the wrapper and nested span.</p>
      ${gapParagraphs}
      <h2 id="Overview_2"><span class="mw-headline">Overview</span></h2>
      <p>Second same-named section.</p>
      <h3 id="Long_section"><span class="mw-headline">A long third-level heading with 日本語 and 中文 to verify that mixed scripts and wrapping keep the complete label visible in the outline</span></h3>
      <p>Final body text.</p>
      ${tailParagraphs}
    </div></div>
  </body></html>`;
  const url = "https://en.wikipedia.org/wiki/W03_Heading_Fixture";
  await page.route(url, route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  const source = await page.evaluate(() => {
    const main = document.querySelector("#mw-content-text .mw-parser-output");
    const headings = [...main.querySelectorAll("h2,h3,h4,h5,h6")].map(node => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll(".mw-editsection,.mw-editsection-like").forEach(edit => edit.remove());
      return { text: clone.textContent.replace(/\s+/g, " ").trim(), level: Number(node.tagName.slice(1)), id: node.id || node.querySelector("[id]")?.id || node.parentElement.id };
    });
    return { headings, shellToc: !!document.querySelector("#vector-toc") };
  });
  await worker.evaluate(async targetUrl => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForSelector("#raccoon-reader-root #reader-content");
  const reader = await page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root"), content = root.querySelector("#reader-content");
    return {
      outline: [...root.querySelectorAll(".reader-outline-item")].map(item => ({
        text: item.querySelector(".reader-outline-label")?.textContent.replace(/\s+/g, " ").trim(),
        level: Number(item.dataset.headingLevel),
        targetId: item.dataset.targetId,
        exists: !!root.querySelector("#" + CSS.escape(item.dataset.targetId))
      })),
      contentHeadings: [...content.querySelectorAll(".reader-paragraph-pair[data-heading='true']")].map(pair => ({
        text: pair.querySelector(".reader-orig-p")?.textContent.replace(/\s+/g, " ").trim(),
        level: Number(pair.dataset.headingLevel)
      })),
      shellTocLeaked: content.textContent.includes("侧栏目录不应进入正文"),
      editLabelLeaked: content.textContent.includes("[edit]")
    };
  });
  if (response?.status() !== 200) throw Error("W03 fixture response was not HTTP 200");
  const sameText = (left, right) => left.replace(/[\s\p{P}\p{S}]+/gu, "") === right.replace(/[\s\p{P}\p{S}]+/gu, "");
  const differences = source.headings.map((heading, index) => {
    const actual = reader.outline[index];
    return { index, source: heading, output: actual, textMatches: !!actual && sameText(heading.text, actual.text), levelMatches: actual?.level === heading.level, targetExists: actual?.exists === true };
  });
  const wideLayout = await page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root"), panel = root.querySelector("#reader-outline-panel"), view = root.querySelector("[data-reader-nav-view='outline']");
    return { viewport: innerWidth, panelWidth: panel.getBoundingClientRect().width, viewWidth: view.getBoundingClientRect().width, rows: [...root.querySelectorAll(".reader-outline-item")].map(item => ({ level: Number(item.dataset.headingLevel), width: item.clientWidth, scrollWidth: item.scrollWidth, labelHeight: item.querySelector(".reader-outline-label")?.clientHeight, labelScrollHeight: item.querySelector(".reader-outline-label")?.scrollHeight })) };
  });
  if (reader.outline.length !== source.headings.length || differences.some(item => !item.textMatches || !item.levelMatches || !item.targetExists) || reader.shellTocLeaked || reader.editLabelLeaked) throw Error("Wikipedia headings lost text, levels, identity or navigation filtering: " + JSON.stringify({ source, reader, differences }));
  const checkTarget = async (selector, expectedTargetId) => {
    await page.evaluate(() => {
      const area = document.querySelector("#raccoon-reader-root #reader-scroll-area");
      area.style.setProperty("scroll-behavior", "auto", "important");
      area.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.evaluate(selectorText => document.querySelector(selectorText)?.click(), selector);
    try {
      await page.waitForFunction(targetId => {
        const root = document.querySelector("#raccoon-reader-root"), area = root?.querySelector("#reader-scroll-area"), target = targetId && root.querySelector("#" + CSS.escape(targetId));
        const rect = target?.getBoundingClientRect(), view = area?.getBoundingClientRect();
        return rect && view && Math.abs(rect.top - view.top - 28) < 70;
      }, expectedTargetId, { timeout: 8000 });
    } catch (error) {
      const state = await page.evaluate(targetId => { const root = document.querySelector("#raccoon-reader-root"), area = root?.querySelector("#reader-scroll-area"), target = targetId && root.querySelector("#" + CSS.escape(targetId)); return { scrollTop: area?.scrollTop, targetTop: target?.getBoundingClientRect().top, areaTop: area?.getBoundingClientRect().top, hash: location.hash }; }, expectedTargetId);
      throw Error("Fragment target did not settle: " + JSON.stringify({ selector, expectedTargetId, state, message: String(error) }));
    }
  };
  const duplicateTarget = reader.outline.filter(item => item.text === "Overview")[1]?.targetId || "";
  const japaneseTarget = reader.outline.find(item => item.text === "日本語の節")?.targetId || "";
  const wrapperTarget = reader.outline.find(item => item.text === "Wrapped section")?.targetId || "";
  await checkTarget('#reader-content a[href*="Overview_2"]', duplicateTarget);
  await checkTarget('#reader-content a[href*="%E6%97%A5%E6%9C%AC%E8%AA%9E"]', japaneseTarget);
  await checkTarget('#reader-content a[href*="wrapper-anchor"]', wrapperTarget);
  await page.setViewportSize({ width: 760, height: 900 });
  const narrowLayout = await page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root"), panel = root.querySelector("#reader-outline-panel"), view = root.querySelector("[data-reader-nav-view='outline']"), content = root.querySelector("#reader-content");
    const long = [...root.querySelectorAll(".reader-outline-item")].find(item => item.textContent.includes("A long third-level heading"));
    const label = long?.querySelector(".reader-outline-label");
    return { viewport: innerWidth, panelWidth: panel.getBoundingClientRect().width, viewWidth: view.getBoundingClientRect().width, contentWidth: content.clientWidth, contentScrollWidth: content.scrollWidth, longLabelHeight: label?.clientHeight || 0, longLabelScrollHeight: label?.scrollHeight || 0, targetCount: root.querySelectorAll(".reader-outline-item").length };
  });
  return { status: response.status(), source, reader, differences, duplicateTarget, wideLayout, narrowLayout, translation: "disabled; original view only" };
}
