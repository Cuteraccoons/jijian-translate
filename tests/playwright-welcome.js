async page => {
 const worker=page.context().serviceWorkers()[0];
 await worker.evaluate(()=>chrome.storage.local.set({welcomeProgress:0}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1280,height:850});
 await page.goto(worker.url().replace('background.js','welcome.html'));
 if(await page.locator('#step-description').innerText()!=='陪你看一个更大的世界。')throw Error('Welcome opening copy changed');
 const next=async()=>{await page.locator('#guide-next').click();await page.waitForTimeout(600);};
 await next();
 if(await page.locator('#step-description').innerText()!=='轻点翻译胶囊，世界触手可及！')throw Error('Translation capsule copy changed');
 if(!await page.locator('#guide-pill-shortcut').isVisible())throw Error('ZZ capsule shortcut should be shown on the capsule page');
 await page.locator('#raccoon-pill-main').click();
 await page.waitForSelector('#guide-complete:not([hidden])');
 const firstArticle=await page.locator('#welcome-article').innerText();
 await next();
 if(await page.locator('#step-description').innerText()!=='侧边分栏对照，不破坏原文阅读体验。提示：没有看到译文时，点击侧边栏中的“显示页面其他内容”。')throw Error('Sidebar copy changed');
 await page.locator('#step-actions button').click();
 await page.waitForSelector('.sidebar-item-trans');
 const gap=await page.evaluate(()=>{const list=document.querySelector('.sidebar-list-content'),card=list.querySelector('.raccoon-sidebar-item');return card.getBoundingClientRect().top-list.getBoundingClientRect().top;});
 if(gap>1)throw Error('First sidebar card gap: '+gap);
 if((await page.locator('#welcome-article').innerText())===firstArticle)throw Error('Article did not change');
 await next();
 if(await page.locator('#step-description').innerText()!=='用干净的方式阅读，用纯粹的心情感受。')throw Error('Reader copy changed');
 if(!await page.locator('#guide-reader-shortcuts').isVisible()||await page.locator('#guide-pill-shortcut').isVisible())throw Error('A and ZZ hints are on the wrong guide pages');
 if(await page.locator('#guide-reader-shortcuts small').innerText()!=='提示：最好先点一下页面的空白处，再连按两下 A。在输入框中输入文字时，此效果不会触发。')throw Error('Reader shortcut hint changed');
 await page.locator('#step-actions button').click();
 await page.waitForSelector('#raccoon-reader-root');
 const media=await page.locator('#reader-content img[src*="welcome-"]').count();if(media!==2)throw Error('Reader sample image count: '+media);
 const reader=await page.locator('.reader-title').innerText();
 for(const width of [230,340]){
  await page.evaluate(width=>document.querySelector('#raccoon-reader-root').style.setProperty('--reader-outline-width',width+'px'),width);
  await page.waitForTimeout(250);
  const visible=await page.locator('.reader-navigator-tabs button span').first().isVisible();
  if(visible!==(width===340))throw Error('Navigation count visibility at '+width);
 }
 await page.evaluate(()=>{window.__guideReader=document.querySelector('#raccoon-reader-root');document.querySelector('#reader-scroll-area').scrollTop=200;});
 await next();
 if(!await page.evaluate(()=>window.__guideReader===document.querySelector('#raccoon-reader-root')))throw Error('Reader was recreated between reading and notes');
 if(!await page.locator('#guide-reader-tip').isVisible())throw Error('Missing in-reader note prompt');
 await next();await page.locator('#guide-lookup-word').dblclick();
 await page.waitForFunction(()=>document.querySelector('.dict-brief-meaning')?.textContent.includes('好奇心'),{},{timeout:10000});
 if(await page.locator('.dict-local-status-note').count())throw Error('Unnecessary local dictionary setup prompt');
 await next();await page.locator('#guide-ocr-image').hover();
 await page.waitForSelector('#raccoon-image-translate-trigger',{state:'visible'});
 await page.locator('#raccoon-image-translate-trigger').click();
 await page.waitForSelector('#raccoon-image-translate-overlay');
 return {media,reader,readerPreserved:true,dictionaryWorks:true,imageFlowOpened:true,sidebarGap:gap,errors};
}
