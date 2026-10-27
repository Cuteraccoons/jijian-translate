async page => {
 // ⌥/Alt + click looks up the word under the pointer, including inside links
 // and in unspaced Chinese. Own fixture; the card's dictionary content comes
 // from the network and is not asserted, only the looked-up word.
 const worker=page.context().serviceWorkers()[0];
 await worker.evaluate(()=>chrome.storage.sync.set({autoTranslateEnabled:false,dictTriggerMode:'both',dictAltClickLookup:true}));
 const body='<!doctype html><html><head><meta charset="utf-8"><title>Lookup fixture</title></head><body style="font:20px/1.8 sans-serif;padding:40px"><p id="en">Coffee is a beverage <a id="link" href="https://reader-fixture.example/elsewhere">brewed</a> from roasted beans.</p><p id="zh" lang="zh-CN">我们今天讨论咖啡的历史。</p></body></html>';
 await page.route('https://reader-fixture.example/**',route=>route.fulfill({contentType:'text/html',body}));
 await page.goto('https://reader-fixture.example/lookup');
 await page.waitForFunction(()=>!!document.querySelector('#raccoon-selection-bubble-root'),null,{timeout:8000});
 const pointOf=(selector,word)=>page.evaluate(([selector,word])=>{const el=document.querySelector(selector);const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const i=n.nodeValue.indexOf(word);if(i>=0){const r=document.createRange();r.setStart(n,i+1);r.setEnd(n,i+2);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};}}return null;},[selector,word]);
 const lookup=async(selector,word)=>{
  const point=await pointOf(selector,word);
  await page.keyboard.down('Alt');await page.mouse.click(point.x,point.y);await page.keyboard.up('Alt');
  await page.waitForSelector('#raccoon-dict-card-el .dict-word-title',{timeout:5000});
  return page.evaluate(()=>({title:document.querySelector('#raccoon-dict-card-el .dict-word-title').textContent.trim(),url:location.href}));
 };
 const link=await lookup('#link','brewed');
 if(link.title!=='brewed')throw Error('link word lookup: '+JSON.stringify(link));
 if(!link.url.endsWith('/lookup'))throw Error('Alt+click followed the link: '+link.url);
 await page.keyboard.press('Escape');
 const zh=await lookup('#zh','咖啡');
 if(zh.title!=='咖啡')throw Error('Chinese word segmentation: '+JSON.stringify(zh));
 await page.keyboard.press('Escape');
 // Plain click on the link still navigates normally.
 await page.click('#link');
 await page.waitForURL('**/elsewhere',{timeout:5000});
 await page.unrouteAll();
 return {passed:true,link:link.title,zh:zh.title};
}
