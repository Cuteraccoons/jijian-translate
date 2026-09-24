async page => {
  const worker = page.context().serviceWorkers()[0];
  if (!worker) throw Error("Native extension service worker required");
  await page.setViewportSize({ width: 1280, height: 900 });
  await worker.evaluate(() => chrome.storage.sync.set({ readerView: "orig", autoTranslateEnabled: false }));

  const cards = Array.from({ length: 6 }, (_, index) => `
    <div class="swiper-slide"><div class="videoCover_fixture" data-card="${index + 1}">
      <div class="coverImg_fixture"></div>${index === 3 ? '<video src="https://video.example.test/clip.mp4" poster="https://video.example.test/poster.svg" preload="none"></video>' : ''}<div class="videoTitle_fixture">样例视频 ${index + 1}</div>
    </div></div>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>视频轮播样例</title><style>
    .swiper-slide-duplicate { display:none }
    .videoCover_fixture { width:220px; height:150px }
  </style></head><body><main class="J-lemma-content">
    <h1>视频轮播样例</h1><p>这是一段自有 fixture 正文，用来验证百科视频轮播不会被摊平成一长列。</p>
    <div class="video-carousel_fixture">${cards}<div class="swiper-slide swiper-slide-duplicate"><div class="videoCover_fixture"><div class="coverImg_fixture"></div><div class="videoTitle_fixture">复制的视频卡</div></div></div></div>
    <p>轮播后面的正文应继续保留，打开阅读模式时也不应等待很久。</p><div style="height:1200px"></div>
    <script>setTimeout(() => document.querySelectorAll('.videoCover_fixture').forEach((cover, index) => {
      if (cover.closest('.swiper-slide-duplicate') || index === 5) return;
      const img = document.createElement('img'); img.alt = '样例封面 ' + (index + 1);
      img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#789"/></svg>');
      cover.querySelector('.coverImg_fixture').append(img);
    }), 600);</script>
  </main></body></html>`;
  await page.route("https://baike.baidu.com/item/Video_Carousel_Fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  const response = await page.goto("https://baike.baidu.com/item/Video_Carousel_Fixture", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.scrollTo(0, 480));
  await page.waitForTimeout(80);
  const source = await page.evaluate(() => ({
    cards: document.querySelectorAll('.videoCover_fixture:not(.swiper-slide-duplicate .videoCover_fixture)').length,
    loadedPosters: document.querySelectorAll('.videoCover_fixture img').length,
    duplicate: document.querySelectorAll('.swiper-slide-duplicate .videoCover_fixture').length,
    scrollY: window.scrollY
  }));
  await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === url);
    for (let attempt = 0; attempt < 15; attempt++) {
      try { await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_READER_MODE" }); return; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
    }
  }, page.url());
  await page.waitForSelector("#raccoon-reader-root .reader-baike-videos", { timeout: 25000 });
  const opened = await page.evaluate(initialScrollY => {
    const root = document.querySelector('#raccoon-reader-root');
    const section = root.querySelector('.reader-baike-videos');
    const viewport = section?.querySelector('.reader-baike-video-viewport');
    return {
      titles: [...section.querySelectorAll('figcaption span')].map(node => node.textContent.trim()),
      headingCount: section.querySelector('.reader-baike-video-heading .reader-baike-video-count')?.textContent.trim(),
      countRows: section.querySelectorAll('p.reader-baike-video-count').length,
      captionLayout: [...section.querySelectorAll('.reader-baike-video-slide')].slice(0, 3).map(slide => {
        const title=slide.querySelector('figcaption span').getBoundingClientRect();
        const link=slide.querySelector('figcaption a').getBoundingClientRect();
        return { titleBottom:title.bottom, linkTop:link.top, linkDisplay:getComputedStyle(slide.querySelector('figcaption a')).display };
      }),
      images: section.querySelectorAll('img').length,
      videos: [...section.querySelectorAll('video')].map(video => ({ controls: video.controls, autoplay: video.autoplay, preload: video.preload, poster: video.getAttribute('poster') })),
      controls: section.querySelectorAll('[data-reader-video-nav]').length,
      cards: section.querySelectorAll('[data-reader-video-slide]').length,
      missingPosterFallback: { text: section.querySelectorAll('[data-reader-video-slide]')[5]?.querySelector('.reader-baike-video-placeholder')?.textContent.trim(), links: section.querySelectorAll('[data-reader-video-slide]')[5]?.querySelectorAll('a[href]').length },
      viewport: viewport ? { clientWidth: viewport.clientWidth, scrollWidth: viewport.scrollWidth, overflowX: getComputedStyle(viewport).overflowX } : null,
      visibleCards: viewport ? [...section.querySelectorAll('[data-reader-video-slide]')].filter(node => { const card=node.getBoundingClientRect(),area=viewport.getBoundingClientRect(); return card.left>=area.left-1&&card.right<=area.right+1; }).length : 0,
      duplicateTitle: [...section.querySelectorAll('figcaption span')].some(node => node.textContent.includes('复制')),
      followingText: root.querySelector('#reader-content')?.textContent.includes('轮播后面的正文应继续保留'),
      scrollRestored: Math.abs(window.scrollY - initialScrollY) < 2
    };
  }, source.scrollY);
  if (response?.status() !== 200) throw Error(`Fixture HTTP status ${response?.status()}`);
  if (source.cards !== 6 || source.loadedPosters !== 0 || source.duplicate !== 1) throw Error(`Fixture source changed: ${JSON.stringify(source)}`);
  if (opened.cards !== 6 || opened.titles.join('|') !== Array.from({ length: 6 }, (_, index) => `样例视频 ${index + 1}`).join('|') || opened.duplicateTitle) throw Error(`Video order or clone filtering failed: ${JSON.stringify(opened)}`);
  if (opened.headingCount !== '（6个）' || opened.countRows !== 0 || opened.captionLayout.some(layout => layout.linkTop < layout.titleBottom - 1 || layout.linkDisplay === 'inline')) throw Error(`Video count or original-page link placement failed: ${JSON.stringify(opened)}`);
  if (opened.images < 3 || opened.visibleCards !== 3 || opened.controls !== 2 || opened.viewport?.scrollWidth <= opened.viewport?.clientWidth) throw Error(`Initial carousel did not load and show three posters: ${JSON.stringify(opened)}`);
  if (opened.videos.length !== 1 || !opened.videos[0].controls || opened.videos[0].autoplay || opened.videos[0].preload !== 'none' || !opened.videos[0].poster) throw Error(`Direct video should be controllable, poster-backed and never autoplay: ${JSON.stringify(opened.videos)}`);
  if (opened.missingPosterFallback.text !== '封面暂未加载' || opened.missingPosterFallback.links < 2) throw Error(`Missing poster should keep a clear fallback and original-page links: ${JSON.stringify(opened.missingPosterFallback)}`);
  await page.locator('.reader-baike-videos [data-reader-video-nav="next"]').click();
  await page.waitForFunction(() => document.querySelector('.reader-baike-videos [data-reader-video-nav="next"]')?.disabled, { timeout: 3000 });
  const forward = await page.evaluate(() => { const section=document.querySelector('#raccoon-reader-root .reader-baike-videos'),viewport=section.querySelector('.reader-baike-video-viewport');return {left:viewport.scrollLeft,previousDisabled:section.querySelector('[data-reader-video-nav="previous"]').disabled,nextDisabled:section.querySelector('[data-reader-video-nav="next"]').disabled}; });
  await page.locator('.reader-baike-videos [data-reader-video-nav="previous"]').click();
  await page.waitForFunction(() => document.querySelector('.reader-baike-videos .reader-baike-video-viewport')?.scrollLeft < 2, { timeout: 3000 });
  const navigation = { forward, returnedToStart: true };
  if (navigation.forward.left < opened.viewport.clientWidth * .8 || navigation.forward.previousDisabled || !navigation.forward.nextDisabled || !navigation.returnedToStart) throw Error(`Carousel arrow navigation failed: ${JSON.stringify(navigation)}`);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(120);
  const narrow = await page.evaluate(() => {
    const section=document.querySelector('#raccoon-reader-root .reader-baike-videos'),viewport=section.querySelector('.reader-baike-video-viewport');
    const area=viewport.getBoundingClientRect();
    return {width:viewport.clientWidth,scrollWidth:viewport.scrollWidth,visible:[...section.querySelectorAll('[data-reader-video-slide]')].filter(node=>{const card=node.getBoundingClientRect();return card.left>=area.left-1&&card.right<=area.right+1;}).length,contentWidth:document.querySelector('#reader-content').clientWidth,contentScrollWidth:document.querySelector('#reader-content').scrollWidth};
  });
  if (narrow.visible !== 1 || narrow.contentScrollWidth > narrow.contentWidth + 1) throw Error(`Narrow carousel overflow or visible-card count failed: ${JSON.stringify(narrow)}`);
  if (!opened.followingText || !opened.scrollRestored) throw Error(`Following prose or page scroll position was lost: ${JSON.stringify(opened)}`);
  return { status: response?.status(), source, opened, navigation, narrow, translation: "disabled; original view only" };
}
