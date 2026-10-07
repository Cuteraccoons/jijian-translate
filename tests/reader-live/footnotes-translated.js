async page=>{
 // Footnote markers in five common shapes must stay clickable inside the
 // Chinese translation, jump within the page (no new tab), and in Reader Mode
 // land on the note. Translation is a local mock of the Google endpoint.
 const worker=page.context().serviceWorkers()[0];
 const result={};
 await worker.evaluate(async()=>{
  await chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false,readerToolsCollapsed:false,displayMode:'bilingual'});
  await chrome.storage.local.set({translationEngine:'google'});
  self.__readerTestFetch=self.fetch;
  self.fetch=async(input,init)=>{const url=String(input?.url||input);if(url.includes('translate.googleapis.com')){const q=new URL(url).searchParams.get('q')||'';const text=q.replace(/Claim (\w+)\./g,'论点$1。').replace(/Note (\w+) explains the source\./g,'注释$1说明来源。');return new Response(JSON.stringify([[[text,q,null,null]],null,'en']),{headers:{'Content-Type':'application/json'}});}return self.__readerTestFetch(input,init);};
 });
 const body=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Footnotes</title></head><body><article><h1>Footnotes</h1>
  <p>Claim alpha.<sup id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup> This paragraph keeps a Wikipedia style citation marker in place.</p>
  <p>Claim beta. <a href="#f2n"><font color="#999999">[2]</font></a> This paragraph uses a bare bracketed link like an old personal essay.</p>
  <p>Claim gamma.<a class="footnote-ref" id="fnref3" href="#fn3" role="doc-noteref"><sup>3</sup></a> This paragraph uses a Pandoc footnote reference.</p>
  <p>Claim delta.<a class="footnote-anchor" id="footnote-anchor-4" href="#footnote-4">4</a> This paragraph uses a Substack footnote anchor.</p>
  <p>Claim epsilon. See <a href="https://example.org/elsewhere#part">the external guide</a> for an ordinary external link that must stay external.</p>
  ${Array.from({length:12},(_,i)=>`<p>Filler paragraph ${i+1} pushes the notes further down so that a jump is measurable on screen.</p>`).join('')}
  <h2>Notes</h2>
  <ol class="references"><li id="cite_note-1"><a href="#cite_ref-1">^</a> Note one explains the source.</li></ol>
  <p><a name="f2n">[2]</a> Note two explains the source.</p>
  <section class="footnotes" role="doc-endnotes"><ol><li id="fn3"><p>Note three explains the source. <a href="#fnref3" role="doc-backlink">↩</a></p></li></ol></section>
  <div class="footnote"><a id="footnote-4" href="#footnote-anchor-4">4</a><div class="footnote-content"><p>Note four explains the source.</p></div></div>
 </article></body></html>`;
 try{
  await page.route('https://reader-fixture.example/**',route=>route.fulfill({contentType:'text/html',body}));
  await page.goto('https://reader-fixture.example/footnotes');
  const send=async action=>worker.evaluate(async ({url,action})=>{const t=(await chrome.tabs.query({})).find(t=>t.url===url);for(let i=0;i<15;i++){try{await chrome.tabs.sendMessage(t.id,{action});return;}catch(e){if(i===14)throw e;await new Promise(r=>setTimeout(r,200));}}},{url:page.url(),action});

  // 1. Page bilingual translation.
  await send('TOGGLE_PAGE_TRANSLATION');
  await page.waitForFunction(()=>document.querySelectorAll('.raccoon-translation-text').length>=5,null,{timeout:15000});
  result.page=await page.evaluate(()=>[...document.querySelectorAll('.raccoon-translation-text')].filter(node=>/论点/.test(node.textContent)).map(node=>({text:node.textContent.slice(0,24),refs:[...node.querySelectorAll('.raccoon-citation a')].map(a=>({label:a.textContent,hash:new URL(a.href).hash,target:a.target||''}))})));
  const pageRefs=result.page.flatMap(item=>item.refs);
  for(const hash of ['#cite_note-1','#f2n','#fn3','#footnote-4'])if(!pageRefs.some(ref=>ref.hash===hash))throw Error(`page translation lost marker ${hash}: ${JSON.stringify(result)}`);
  if(pageRefs.some(ref=>ref.target==='_blank'))throw Error('same-page footnote opens a new tab: '+JSON.stringify(result));
  if(result.page.some(item=>item.refs.some(ref=>ref.hash==='#part')))throw Error('external link mistaken for a footnote');
  const pageBefore=page.url();
  await page.locator('.raccoon-translation-text .raccoon-citation a[href$="#fn3"]').first().click();
  await page.waitForTimeout(200);
  result.pageJump={url:page.url(),pages:page.context().pages().filter(p=>!p.url().startsWith('chrome-extension://')).length};
  if(!result.pageJump.url.endsWith('#fn3')||result.pageJump.pages!==1)throw Error('page footnote did not jump in place: '+JSON.stringify(result.pageJump));
  await send('TOGGLE_PAGE_TRANSLATION');
  await page.goto('about:blank');await page.goto('https://reader-fixture.example/footnotes');

  // 2. Reader Mode, bilingual view.
  await send('TOGGLE_READER_MODE');
  await page.waitForSelector('#reader-content');
  await page.locator('.reader-mode-btn[data-mode="bilingual"]:visible').click();
  await page.waitForFunction(()=>document.querySelectorAll('.reader-trans-p[data-loaded="true"] .raccoon-citation').length>=4,null,{timeout:15000});
  result.reader=await page.evaluate(()=>[...document.querySelectorAll('.reader-trans-p .raccoon-citation a')].map(a=>({label:a.textContent,hash:new URL(a.href).hash,target:a.target||''})));
  if(result.reader.some(ref=>ref.target==='_blank'))throw Error('reader footnote opens a new tab: '+JSON.stringify(result.reader));
  for(const [hash,note] of [['#fn3','Note three'],['#footnote-4','Note four'],['#cite_note-1','Note one']]){
   await page.evaluate(()=>{document.querySelector('#reader-scroll-area').scrollTop=0;});
   await page.locator(`.reader-trans-p .raccoon-citation a[href$="${hash}"]`).first().click();
   await page.waitForTimeout(700);
   const landed=await page.evaluate(note=>{const area=document.querySelector('#reader-scroll-area'),box=area.getBoundingClientRect();const node=[...document.querySelectorAll('#reader-content .reader-orig-p')].find(p=>p.textContent.includes(note));const r=node?.getBoundingClientRect();return {scrolled:area.scrollTop>0,visible:!!r&&r.top>=box.top-2&&r.bottom<=box.bottom+2,url:location.href,open:!!document.querySelector('#raccoon-reader-root')};},note);
   if(!landed.scrolled||!landed.visible||!landed.open||landed.url.includes('#'))throw Error(`reader jump ${hash} failed: ${JSON.stringify(landed)}`);
  }
  result.readerJumps='ok';
 }finally{
  await worker.evaluate(()=>{if(self.__readerTestFetch){self.fetch=self.__readerTestFetch;delete self.__readerTestFetch;}});
  await page.unrouteAll();
 }
 return result;
}
