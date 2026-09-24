async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));

  const shared = "https://assets.example.test/shared.png";
  const tableOnly = "https://assets.example.test/table-only.png";
  const oneRowOnly = "https://assets.example.test/one-row-only.png";
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Image ownership fixture</title></head><body><main class="J-lemma-content">
    <h1>图片归属样例</h1>
    <p>这是一段自有 fixture 正文，用来确认阅读模式保留百度百科表格、图注与相邻基本信息。</p>
    <div class="J-basic-info"><dl><dt>地区</dt><dd>示例市</dd></dl></div>
    <table class="tableBox_fixture"><tbody>
      <tr><td><div class="para_fixture"><span>表内说明甲</span><img src="${shared}" alt="表格中的共享图" width="240" height="140"></div></td><td><div class="para_fixture"><span>表内说明乙</span><img src="${tableOnly}" alt="表格独有图" width="240" height="140"></div></td></tr>
      <tr><td><div class="para_fixture">第二行，保留表格顺序</div></td><td><div class="para_fixture">第二行补充信息</div></td></tr>
    </tbody></table>
    <figure><img src="${shared}" alt="独立图中的复用图" width="240" height="140"><figcaption>独立图注：相同图片地址在正文另有说明</figcaption></figure>
    <table class="ordinary-fixture"><tbody><tr><th>字段</th><th>内容</th></tr><tr><td>型号</td><td>示例设备</td></tr></tbody></table>
    <table class="one-row-fixture"><tbody><tr><td><div class="para_keep">未被采集为表格的单行图片内容 <img src="${oneRowOnly}" alt="单行内容图" width="220" height="120"></div></td></tr></tbody></table>
  </main></body></html>`;
  await page.route("https://baike.baidu.com/item/Image_Ownership_Fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  const response = await page.goto("https://baike.baidu.com/item/Image_Ownership_Fixture", { waitUntil: "domcontentloaded" });
  const source = await page.evaluate(() => {
    const root = document.querySelector(".J-lemma-content");
    return {
      tableImages: root.querySelector(".tableBox_fixture").querySelectorAll("img").length,
      sharedImageNodes: [...root.querySelectorAll("img")].filter(image => image.src === "https://assets.example.test/shared.png").length,
      oneRowText: root.querySelector(".one-row-fixture").textContent.trim()
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
  const result = await page.evaluate(() => {
    const root = document.querySelector("#raccoon-reader-root");
    const content = root.querySelector("#reader-content");
    const table = content.querySelector(".reader-data-table");
    const figure = content.querySelector(".reader-media-block");
    const sourceUrl = value => new URL(value, location.href).origin + new URL(value, location.href).pathname;
    const images = [...content.querySelectorAll("img")].filter(image => image.src.includes("assets.example.test/"));
    const sharedImages = images.filter(image => sourceUrl(image.src) === "https://assets.example.test/shared.png");
    const tableImages = [...(table?.querySelectorAll("img") || [])];
    const ordinary = content.querySelector(".reader-data-table:not(#" + table?.id + ")");
    const facts = [...content.querySelectorAll(".reader-infobox .reader-fact-row")].map(row => row.innerText.replace(/\s+/g, " ").trim());
    return {
      table: { exists: !!table, rows: table?.querySelectorAll("tbody tr").length || 0, images: tableImages.map(image => image.alt), text: table?.innerText.replace(/\s+/g, " ").trim() || "" },
      figure: { exists: !!figure, images: figure?.querySelectorAll("img").length || 0, mediaIndex: figure?.querySelector("img")?.getAttribute("data-reader-media-index") || "", caption: figure?.querySelector(".reader-figcaption .reader-orig-p")?.textContent.trim() || "" },
      sharedOutputCount: sharedImages.length,
      oneRowOutput: [...content.querySelectorAll(".reader-paragraph-pair")].map(pair => pair.innerText.replace(/\s+/g, " ").trim()).find(text => text.includes("未被采集为表格的单行图片内容")) || "",
      oneRowImageCount: images.filter(image => sourceUrl(image.src) === "https://assets.example.test/one-row-only.png").length,
      facts,
      ordinaryTableRows: ordinary?.querySelectorAll("tbody tr").length || 0,
      ordinaryTableText: [...(ordinary?.querySelectorAll(".reader-orig-p") || [])].map(node => node.textContent.replace(/\s+/g, " ").trim()).join(" ")
    };
  });
  if (response?.status() !== 200) throw Error(`Fixture HTTP status ${response?.status()}`);
  if (source.tableImages !== 2 || source.sharedImageNodes !== 2) throw Error(`Fixture source changed: ${JSON.stringify(source)}`);
  if (!result.table.exists || result.table.rows !== 2 || result.table.images.join("|") !== "表格中的共享图|表格独有图") throw Error(`Table content was lost or reordered: ${JSON.stringify(result.table)}`);
  if (!result.figure.exists || result.figure.images !== 1 || result.figure.caption !== "独立图注：相同图片地址在正文另有说明" || result.figure.mediaIndex !== "2") throw Error(`Reused image or its figure caption/index was lost: ${JSON.stringify(result.figure)}`);
  if (result.sharedOutputCount !== 2) throw Error(`Shared URL should appear once in its table and once in its independent figure: ${result.sharedOutputCount}`);
  if (!result.oneRowOutput.includes("未被采集为表格的单行图片内容") || result.oneRowImageCount !== 1) throw Error(`Dropped parent also swallowed its child content: ${JSON.stringify(result)}`);
  if (result.facts.length !== 1 || !result.facts[0].includes("地区") || !result.facts[0].includes("示例市")) throw Error(`Baike basic info regression: ${JSON.stringify(result.facts)}`);
  if (result.ordinaryTableRows !== 2 || !result.ordinaryTableText.includes("示例设备")) throw Error(`Ordinary data table regression: ${JSON.stringify(result)}`);
  return { status: response?.status(), source, result, translation: "disabled; original view only" };
}
