async page=>{
 // Page-builder structures (CFA Institute style): collapsed accordions whose
 // panels are display:none / aria-hidden, a row of side-by-side cards, and a
 // section heading that repeats the page title. Own fixture, original mode.
 const worker=page.context().serviceWorkers()[0];
 await worker.evaluate(()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false,readerToolsCollapsed:false}));
 const prose=n=>`<p>Paragraph ${n}. Building a structured model means separating assumptions from calculations so that every schedule can be audited and changed safely.</p>`;
 const unit=(i,open)=>`<div class="acc-title"><a href="#unit-${i}" aria-expanded="${open}">Unit ${i}: Topic ${i}</a></div><div id="unit-${i}" class="acc-content" style="display:${open?'block':'none'}"><ul><li>Unit ${i} objective one explains the schedule.</li><li>Unit ${i} objective two links the statements.</li></ul></div>`;
 const body=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Financial Modeling | Example</title>
 <style>.row{display:flex;gap:16px}.row>div{flex:1;border:1px solid #ccc;padding:12px}</style></head><body>
 <header><nav><button aria-expanded="false" aria-haspopup="true" aria-controls="menu">Programs menu</button><ul id="menu" style="display:none"><li><a href="/a">Menu entry hidden</a></li></ul></nav></header>
 <main><h1>Financial Modeling</h1>
  <div class="section"><div class="boxed"><h2>What is financial modeling?</h2><div class="wysiwyg">${prose(1)}${prose(2)}</div></div></div>
  <div class="section"><div class="boxed"><h2>Structure &amp; duration</h2><div class="row"><div><h3>10–20 hours to complete</h3></div><div><h3>Online self-paced</h3><p>Modules can be completed at your own pace.</p></div><div><h3>Certificate</h3><p>Earn a digital badge.</p><a href="https://example.org/badge">Learn more</a></div></div></div></div>
  <div class="section"><div class="boxed"><h2>Overview</h2><div class="wysiwyg">${prose(3)}${prose(4)}${prose(5)}</div></div></div>
  <div class="section"><div class="boxed"><h2>Skills covered by unit</h2><div class="wysiwyg"><p>The module is organised into units that build one model step by step.</p></div>
   <div class="accordion">${unit(1,false)}${unit(2,false)}${unit(3,true)}${unit(4,false)}</div></div></div>
  <div class="section"><div class="boxed"><h2>FAQs</h2>
   <div class="faq"><h3><button aria-expanded="false" aria-controls="faq-1">Do I need prior experience?</button></h3><div id="faq-1" aria-hidden="true" hidden><p>No prior modelling experience is required, but spreadsheet basics help.</p></div></div>
   <div class="faq"><h3><button aria-expanded="false" data-bs-target="#faq-2">Which software is used?</button></h3><div id="faq-2" class="collapse"><p>The course uses Microsoft Excel throughout every unit.</p></div></div>
   <div class="faq"><div class="faq-q"><button aria-expanded="false">How long does it take?</button></div><div class="faq-answer" style="display:none"><p>Most candidates finish within twenty hours of study.</p></div></div>
  </div></div>
 </main></body></html>`;
 await page.route('https://reader-fixture.example/**',route=>route.fulfill({contentType:'text/html',body}));
 await page.goto('https://reader-fixture.example/accordion-cards');
 await worker.evaluate(async url=>{const t=(await chrome.tabs.query({})).find(t=>t.url===url);for(let i=0;i<15;i++){try{await chrome.tabs.sendMessage(t.id,{action:'TOGGLE_READER_MODE'});return;}catch(e){if(i===14)throw e;await new Promise(r=>setTimeout(r,200));}}},page.url());
 await page.waitForSelector('#reader-content');
 const result=await page.evaluate(()=>{
  const content=document.querySelector('#reader-content');
  const accordions=[...content.querySelectorAll('.reader-accordion')].map(d=>({open:d.open,title:d.querySelector('.reader-accordion-summary .reader-orig-p')?.textContent.trim(),items:d.querySelectorAll('.reader-accordion-body .reader-orig-p').length,text:d.querySelector('.reader-accordion-body')?.textContent.replace(/\s+/g,' ').trim().slice(0,80)}));
  const cards=[...content.querySelectorAll('.reader-card-grid .reader-card')].map(c=>({title:c.querySelector('.reader-card-title .reader-orig-p')?.textContent.trim(),text:c.querySelector('.reader-card-text .reader-orig-p')?.textContent.trim()||'',links:[...c.querySelectorAll('.reader-card-link')].map(a=>a.textContent.trim())}));
  const outline=[...document.querySelectorAll('.reader-outline-item')].map(b=>b.textContent.trim());
  return {accordions,cards,outline,toolbar:content.querySelector('.reader-accordion-toolbar')?.textContent.trim()||'',menuLeak:content.textContent.includes('Menu entry hidden')||content.textContent.includes('Programs menu')};
 });
 const fail=message=>{throw Error(message+' '+JSON.stringify(result));};
 if(result.accordions.length!==7)fail('expected 4 unit + 3 FAQ accordions');
 const units=result.accordions.slice(0,4);
 if(units.some((u,i)=>u.title!==`Unit ${i+1}: Topic ${i+1}`||u.items!==2))fail('unit accordions lost their titles or hidden list items');
 if(units.map(u=>u.open).join()!=='false,false,true,false')fail('accordion open state should follow the source');
 const faqText=result.accordions.slice(4).map(a=>a.text).join(' ');
 for(const answer of ['No prior modelling experience','Microsoft Excel','twenty hours'])if(!faqText.includes(answer))fail(`FAQ answer missing: ${answer}`);
 if(result.cards.length!==3||result.cards[0].title!=='10–20 hours to complete'||!result.cards[1].text.includes('own pace')||result.cards[2].links[0]!=='Learn more')fail('card row not kept as a grid');
 if(result.outline.some(item=>/hours to complete|self-paced|Certificate|Unit 1|prior experience/.test(item)))fail('card or accordion titles leaked into the outline');
 if(!result.outline.includes('What is financial modeling?'))fail('a section heading that contains the page title was dropped');
 if(result.menuLeak)fail('header navigation menu leaked into the article');
 if(!/4 项/.test(result.toolbar))fail('expand-all toolbar missing for the unit run');
 await page.locator('.reader-accordion-toolbar button').first().click();
 const allOpen=await page.evaluate(()=>[...document.querySelectorAll('#reader-content .reader-accordion')].slice(0,4).every(d=>d.open));
 if(!allOpen)fail('expand-all did not open the run');
 await page.unrouteAll();
 return {passed:true,accordions:result.accordions.length,cards:result.cards.length,outline:result.outline};
}
