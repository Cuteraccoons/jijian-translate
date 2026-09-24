async page => {
  const worker=page.context().serviceWorkers()[0];
  if(!worker)throw Error('Native extension service worker required');
  await page.setViewportSize({width:1280,height:900});
  await worker.evaluate(()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false}));
  const svg=(width,height,color)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`;
  const albumImages=[[240,120,'#789'],[120,240,'#987'],[180,180,'#798']].map(([width,height,color])=>`<a class="swiperLi_fixture" style="float:left"><img src="${svg(width,height,color)}" width="${width}" height="${height}" alt="这组照片共用的说明"></a>`).join('');
  const videoCards=[['03:22','第一段视频','#678'],['01:14','第二段视频','#876'],['04:08','第三段视频','#687']].map(([duration,title,color])=>`<div class="videoContainer_fixture"><div class="video_fixture"><img class="coverImg_fixture" src="${svg(320,180,color)}"><span>${duration}</span></div><div class="videoInfo_fixture">${title}</div></div>`).join('');
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>百科正文媒体样例</title><style>.videoWrap_fixture{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.videoContainer_fixture{min-width:0}</style></head><body><main class="J-lemma-content"><h1>正文媒体样例</h1><div class="para_fixture"><p>照片组说明：这组照片共用的说明</p><div data-module-type="album">${albumImages}</div></div><div class="para_fixture"><p>视频前的正文仍应保留。</p><div data-module-type="video"><div class="videoWrap_fixture">${videoCards}</div></div></div><p>视频后的普通正文仍应保留。</p></main></body></html>`;
  await page.route('https://baike.baidu.com/item/Body_Media_Fixture',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  const response=await page.goto('https://baike.baidu.com/item/Body_Media_Fixture',{waitUntil:'domcontentloaded'});
  await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(item=>item.url===url);for(let attempt=0;attempt<15;attempt++){try{await chrome.tabs.sendMessage(tab.id,{action:'TOGGLE_READER_MODE'});return;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},page.url());
  await page.waitForSelector('#raccoon-reader-root .reader-baike-module-videos',{timeout:25000});
  const wide=await page.evaluate(()=>{
    const root=document.querySelector('#raccoon-reader-root'),content=root.querySelector('#reader-content'),gallery=content.querySelector('.reader-baike-module-gallery'),videoGroup=content.querySelector('.reader-baike-module-videos');
    const boxes=[...gallery.querySelectorAll('.reader-baike-gallery-image')].map(node=>node.getBoundingClientRect().width);
    const posters=[...videoGroup.querySelectorAll('.reader-baike-module-video-media')].map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,ratio:getComputedStyle(node).aspectRatio}));
    const text=content.innerText;
    const mediaLabels=[...root.querySelectorAll('.reader-media-index-item b')].map(node=>node.textContent.trim());
    return {galleryImages:boxes.length,galleryWidths:boxes,sharedCaptionCount:(text.match(/这组照片共用的说明/g)||[]).length,galleryItemCaptions:gallery.querySelectorAll('figure figcaption').length,mediaLabels,videoTitles:[...videoGroup.querySelectorAll('figure figcaption')].map(node=>node.textContent.trim()),videoLinks:videoGroup.querySelectorAll('figure a[href]').length,posters,videoBeforeText:text.includes('视频前的正文仍应保留。'),videoAfterText:text.includes('视频后的普通正文仍应保留。'),overflow:content.scrollWidth-content.clientWidth};
  });
  if(response?.status()!==200)throw Error(`Fixture HTTP status ${response?.status()}`);
  if(wide.galleryImages!==3||Math.max(...wide.galleryWidths)-Math.min(...wide.galleryWidths)>1||wide.galleryItemCaptions!==0||wide.sharedCaptionCount!==1)throw Error(`Grouped photos should have equal slots and a single shared caption: ${JSON.stringify(wide)}`);
  if(wide.mediaLabels.join('|')!=='这组照片共用的说明|组图第2张|组图第3张')throw Error(`Media index should not repeat a shared album caption on every photo: ${JSON.stringify(wide.mediaLabels)}`);
  if(wide.videoTitles.join('|')!=='第一段视频|第二段视频|第三段视频'||wide.videoLinks!==3||wide.posters.some(poster=>poster.ratio!=='16 / 9'||Math.abs(poster.width/poster.height-16/9)>.03))throw Error(`Body videos should render as uniform poster cards: ${JSON.stringify(wide)}`);
  if(!wide.videoBeforeText||!wide.videoAfterText||wide.overflow>1)throw Error(`Surrounding prose or page width changed: ${JSON.stringify(wide)}`);
  await page.setViewportSize({width:390,height:900});
  const narrow=await page.evaluate(()=>{const content=document.querySelector('#reader-content'),cards=[...content.querySelectorAll('.reader-baike-module-video-media')].map(node=>({width:node.clientWidth,height:node.clientHeight}));return {contentWidth:content.clientWidth,scrollWidth:content.scrollWidth,videoCards:cards};});
  if(narrow.scrollWidth>narrow.contentWidth+1||narrow.videoCards.some(card=>card.width<=0||Math.abs(card.width/card.height-16/9)>.04))throw Error(`Narrow body media layout overflowed: ${JSON.stringify(narrow)}`);
  return {status:response?.status(),wide,narrow,translation:'disabled; original view only'};
}
