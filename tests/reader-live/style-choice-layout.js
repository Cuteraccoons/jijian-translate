async page=>{
 const worker=page.context().serviceWorkers()[0];
 await worker.evaluate(()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false,readerToolsCollapsed:false,readerFirstLineIndent:false,readerFontSize:'17.5'}));
 const tab=page,results=[],indentResults=[];
 await tab.route('https://reader-fixture.example/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><article><h1>阅读样式</h1><p>中文正文段落用于检查首行缩进设置是否只影响正文，并在重新进入阅读模式后保留用户偏好。</p><h2>小节</h2><p>第二段中文内容用于确认切换关闭后恢复到原来的左边界。</p></article></body></html>'}));
 await tab.goto('https://reader-fixture.example/choices');
 await worker.evaluate(async url=>{const t=(await chrome.tabs.query({})).find(t=>t.url===url);for(let i=0;i<15;i++){try{await chrome.tabs.sendMessage(t.id,{action:'TOGGLE_READER_MODE'});return;}catch(e){if(i===14)throw e;await new Promise(r=>setTimeout(r,200));}}},tab.url());
 await tab.waitForSelector('#reader-content');
  for(const viewport of [1440,800]){
   await tab.setViewportSize({width:viewport,height:1000});
   if(!await tab.locator('[data-reader-tool-tab="appearance"]').isVisible())await tab.locator('#reader-btn-open-settings').click();
   await tab.locator('[data-reader-tool-tab="article"]').click();
   if(await tab.locator('#reader-toggle-first-line-indent').isVisible())throw Error('First-line indent belongs in the 排版 panel, not the 文章 panel');
   await tab.locator('[data-reader-tool-tab="appearance"]').click();
   const indentToggle=tab.locator('#reader-toggle-first-line-indent');
   if(!await indentToggle.isVisible())throw Error('First-line indent toggle is not visible in the format panel');
   if(!await tab.locator('#reader-content .reader-infobox').count())await tab.locator('#reader-content').evaluate(content=>{const card=document.createElement('section');card.className='reader-infobox';card.innerHTML='<div class="reader-paragraph-pair"><p class="reader-orig-p" lang="zh-CN">基本信息中的中文值不应缩进。</p></div>';content.append(card);});
   const paragraph=tab.locator('p.reader-orig-p[lang^="zh"]').first();
   const beforeIndent=await paragraph.evaluate(node=>getComputedStyle(node).textIndent);
   if(beforeIndent!=='0px')throw Error(`First-line indent should default off, got ${beforeIndent}`);
   await indentToggle.check();
   const appliedIndent=await paragraph.evaluate(node=>getComputedStyle(node).textIndent);
   const appliedGeometry=await paragraph.evaluate(node=>({indent:parseFloat(getComputedStyle(node).textIndent),fontSize:parseFloat(getComputedStyle(node).fontSize)}));
   if(Math.abs(appliedGeometry.indent-appliedGeometry.fontSize*2)>.6)throw Error(`Two-character indent not applied, got ${JSON.stringify(appliedGeometry)}`);
   const infoIndent=await tab.locator('.reader-infobox .reader-orig-p').evaluate(node=>getComputedStyle(node).textIndent);
   if(infoIndent!=='0px')throw Error(`Infobox facts should not inherit paragraph indentation, got ${infoIndent}`);
   const headingIndent=await tab.locator('.reader-paragraph-pair[data-heading="true"] .reader-orig-p').first().evaluate(node=>getComputedStyle(node).textIndent);
   if(headingIndent!=='0px')throw Error(`Heading was indented, got ${headingIndent}`);
   await indentToggle.uncheck();
   const clearedIndent=await paragraph.evaluate(node=>getComputedStyle(node).textIndent);
   if(clearedIndent!=='0px')throw Error(`First-line indent did not turn off, got ${clearedIndent}`);
   indentResults.push({viewport,default:beforeIndent,on:appliedIndent,geometry:appliedGeometry,heading:headingIndent,infobox:infoIndent,off:clearedIndent});
   await tab.locator('[data-reader-tool-tab="appearance"]').click();
   for(const width of [260,320,420]){
    await tab.locator('#raccoon-reader-root').evaluate((root,width)=>root.style.setProperty('--reader-tools-width',width+'px'),width);
    for(const theme of ['white','dark']){
     await tab.locator(`[data-reader-theme-quick="${theme}"]`).click();
     const geometry=await tab.locator('#reader-outline-accent').evaluate(group=>{
      const rect=group.getBoundingClientRect(),buttons=[...group.querySelectorAll('button')],boxes=buttons.map(n=>n.getBoundingClientRect());
      const overlaps=boxes.some((a,i)=>boxes.some((b,j)=>j>i&&Math.min(a.right,b.right)>Math.max(a.left,b.left)+.5&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+.5));
      return {display:getComputedStyle(group).display,overlaps,contained:boxes.every(b=>b.left>=rect.left-.5&&b.right<=rect.right+.5),labelsFit:buttons.every(b=>b.scrollWidth<=b.clientWidth+1&&b.scrollHeight<=b.clientHeight+1),width:rect.width,heights:boxes.map(b=>b.height)};
     });
     // 1.0.6: outline accents are 26 px colour swatches (flex row), same as the paper swatches; keep the no-overlap / containment checks.
     if(!['grid','flex'].includes(geometry.display)||geometry.overlaps||!geometry.contained||!geometry.labelsFit||geometry.heights.some(h=>h<24))throw Error(JSON.stringify({viewport,width,theme,geometry}));
     results.push({viewport,width,theme,...geometry});
    }
   }
  }
  const green=tab.locator('#reader-outline-accent [data-value="green"]');await green.focus();await tab.keyboard.press('Enter');
  if(await green.getAttribute('aria-pressed')!=='true')throw Error('Keyboard selection failed');
 await tab.unrouteAll();
 return {passed:true,cases:results.length,firstLineIndent:indentResults,results};
}
