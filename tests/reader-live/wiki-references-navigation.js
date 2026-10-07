async page=>{
 const worker=page.context().serviceWorkers()[0];
 if(!worker)throw Error('Native extension service worker required');
 await worker.evaluate(async()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false,readerOutlineCollapsed:false}));
 const toggle=async tabUrl=>worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).filter(t=>t.url===url).at(-1);if(!tab)throw Error('Current extension tab not found');for(let i=0;i<15;i++){try{await chrome.tabs.sendMessage(tab.id,{action:'TOGGLE_READER_MODE'});return;}catch(error){if(i===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},tabUrl);
 await page.setViewportSize({width:1440,height:1000});
 for(const oldPage of page.context().pages().filter(item=>item!==page&&item.url().includes('/wiki/W04_fixture')))await oldPage.close();
 const fixturePage=page;
 await fixturePage.route('https://en.wikipedia.org/wiki/W04_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>W04 fixture</title></head><body><main id="mw-content-text"><div class="mw-parser-output"><h1>W04 fixture</h1><p id="claim-one">First claim has enough context to test a citation target <sup class="reference" id="cite_ref-one"><a href="#cite_note-one">[1]</a></sup> and reuses that source <sup class="reference" id="cite_ref-one-b"><a href="#cite_note-one">[1]</a></sup>.</p><p id="claim-two">A second claim carries a broken citation target <sup class="reference"><a href="#cite_note-missing">[2]</a></sup> while ordinary linked reading remains available.</p><ol class="references"><li id="cite_note-one">A single source entry with two return links. <a href="#cite_ref-one">↑</a><a href="#cite_ref-one-b">↩</a></li></ol><div class="navbox"><table><tbody><tr><th class="navbox-title"><button class="mw-collapsible-toggle">hide</button><span class="navbar">vte</span><span>Topic map</span><style>.fixture{display:none}.mw-parser-output .navbar{font-size:88%}</style></th></tr><tr><td><a href="/wiki/Visible_entry">Visible entry</a><table class="navbox"><tbody><tr><th>Nested group</th><td><a href="/wiki/Nested_entry">Nested entry</a></td></tr></tbody></table></td></tr></tbody></table></div><div class="sistersitebox"><p><strong>Sister projects</strong></p><a href="https://en.wikibooks.org/wiki/Example">Example sister resource</a></div></div></main></body></html>`}));
 await fixturePage.goto('https://en.wikipedia.org/wiki/W04_fixture',{waitUntil:'domcontentloaded'});
 await toggle(fixturePage.url());
 await fixturePage.waitForSelector('#raccoon-reader-root #reader-content',{timeout:20000});
 const fixture=await fixturePage.evaluate(()=>{const content=document.querySelector('#reader-content'),supplements=[...content.querySelectorAll('.reader-supplement')],navbox=supplements.find(node=>node.classList.contains('reader-supplement-navbox')),allLinks=[...content.querySelectorAll('a[href]')],byHash=hash=>allLinks.find(a=>new URL(a.href).hash===hash),click=a=>{if(!a)return null;const event=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(event);return event.defaultPrevented;};return {supplementCount:supplements.length,navboxTitle:navbox?.querySelector('summary')?.textContent.trim(),navboxClosed:navbox?!navbox.open:false,navboxLinks:[...(navbox?.querySelectorAll('a[href]')||[])].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})),sisterboxOpen:supplements.find(node=>!node.classList.contains('reader-supplement-navbox'))?.open||false,citationOneMapped:click(byHash('#cite_note-one')),firstBacklinkMapped:click(byHash('#cite_ref-one')),secondBacklinkMapped:click(byHash('#cite_ref-one-b')),brokenCitationKept:!!byHash('#cite_note-missing'),brokenCitationStaysInReader:click(byHash('#cite_note-missing'))===true&&!!document.querySelector('#raccoon-reader-root'),styleLeaked:navbox?.textContent.includes('.mw-parser-output')||false};});
 const fixtureProblems=[];
 if(fixture.supplementCount!==2||fixture.navboxTitle!=='Topic map'||!fixture.navboxClosed||!fixture.sisterboxOpen)fixtureProblems.push('supplement-structure');
 if(!fixture.navboxLinks.some(link=>link.href.endsWith('/wiki/Visible_entry'))||!fixture.navboxLinks.some(link=>link.href.endsWith('/wiki/Nested_entry')))fixtureProblems.push('nested-navbox-links');
 if(!fixture.citationOneMapped||!fixture.firstBacklinkMapped||!fixture.secondBacklinkMapped||!fixture.brokenCitationKept||!fixture.brokenCitationStaysInReader)fixtureProblems.push('citation-and-backlink-mapping');
 if(fixture.styleLeaked)fixtureProblems.push('template-style-leak');
 if(fixtureProblems.length)throw Error(`W04 self-authored fixture mismatch: ${JSON.stringify({fixture,fixtureProblems})}`);
 const cases=[
  {name:'Queen’s Pawn Game',url:'https://en.wikipedia.org/wiki/Queen%27s_Pawn_Game'},
  {name:'Anthropology',url:'https://en.wikipedia.org/wiki/Anthropology'}
 ];
 const results=[];
 for(const item of cases){
  let response;
  try{response=await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:35000});await page.waitForSelector('#mw-content-text .mw-parser-output',{timeout:15000});}
  catch(error){results.push({name:item.name,available:false,status:response?.status()||null,reason:String(error).slice(0,180)});continue;}
  const source=await page.evaluate(()=>{
   const main=document.querySelector('#mw-content-text .mw-parser-output');
   const roots=[...main.querySelectorAll('.navbox,.sistersitebox')].filter(node=>!node.parentElement.closest('.navbox,.sistersitebox'));
   const refs=[...main.querySelectorAll('ol.references li[id],.reflist li[id]')];
   const markers=[...main.querySelectorAll('sup.reference a[href^="#"]')];
   const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
   return {url:location.href,title:document.title,markers:markers.slice(0,6).map(a=>({label:clean(a.textContent),href:a.getAttribute('href'),target:!!document.getElementById(decodeURIComponent(a.hash.slice(1)))})),references:refs.slice(0,8).map(li=>({id:li.id,text:clean(li.textContent).slice(0,150),backlinks:[...li.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href'))})),supplements:roots.map(root=>({class:root.className,title:clean(root.querySelector('.navbox-title')?.textContent||root.querySelector('caption')?.textContent),links:[...root.querySelectorAll('a[href]')].map(a=>({text:clean(a.textContent),href:a.href})).filter(x=>x.text).slice(0,18),linkCount:root.querySelectorAll('a[href]').length,nestedSupplements:root.querySelectorAll('.navbox,.sistersitebox').length}))};
  });
  if(response?.status()!==200||/captcha|verify|验证/i.test(source.title)){results.push({name:item.name,status:response?.status()||null,available:false,title:source.title,reason:'source unavailable or verification page'});continue;}
  const url=page.url();
  await toggle(url);
  await page.waitForSelector('#raccoon-reader-root #reader-content',{timeout:35000});
  const output=await page.evaluate(()=>{
   const content=document.querySelector('#reader-content');
   const supplements=[...content.querySelectorAll('.reader-supplement')].map(root=>({class:root.className,title:root.querySelector('summary')?.textContent.trim(),open:root.open,links:[...root.querySelectorAll('a[href]')].map(a=>({text:a.textContent.replace(/\s+/g,' ').trim(),href:a.href})).filter(a=>a.text)}));
   const forwardLinks=[...content.querySelectorAll('.reader-orig-p a[href]')].filter(a=>a.href.includes('#cite_note-'));
   const returnLinks=[...content.querySelectorAll('.reader-orig-p a[href]')].filter(a=>a.href.includes('#cite_ref-'));
   const click=link=>{if(!link)return null;const event=new MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);return {prevented:event.defaultPrevented,href:link.getAttribute('href')};};
   const result={supplements,citationMarkers:forwardLinks.length,citation:click(forwardLinks[0]),referenceBacklinkCount:returnLinks.length,backlink:click(returnLinks[0]),contentWidth:content.clientWidth,contentScrollWidth:content.scrollWidth};
   return result;
  });
  const sourceSupplementLinks=source.supplements.reduce((sum,x)=>sum+x.linkCount,0);
  const outputSupplementLinks=output.supplements.reduce((sum,x)=>sum+x.links.length,0);
  const check={status:response.status(),sourceSupplements:source.supplements.length,readerSupplements:output.supplements.length,sourceSupplementLinks,outputSupplementLinks,citationMarkers:output.citationMarkers,citationMapped:output.citation?.prevented||false,referenceBacklinkMapped:output.backlink?.prevented||false,noHorizontalOverflow:output.contentScrollWidth<=output.contentWidth+1};
  const differences=[];
  if(source.supplements.length&&output.supplements.length!==source.supplements.length)differences.push('supplement-root-count');
  if(sourceSupplementLinks&&outputSupplementLinks<Math.ceil(sourceSupplementLinks*.7))differences.push('supplement-link-retention');
  if(source.markers.length&&(!output.citationMarkers||!check.citationMapped))differences.push('citation-target-mapping');
  if(source.references.some(ref=>ref.backlinks.length)&&!check.referenceBacklinkMapped)differences.push('reference-backlink-mapping');
  if(output.supplements.some(item=>item.class.includes('reader-supplement-navbox')&&item.open))differences.push('navbox-not-collapsed');
  if(output.supplements.some(item=>!item.class.includes('reader-supplement-navbox')&&!item.open))differences.push('sisterbox-not-open');
  if(output.supplements.some(item=>/\.mw-parser-output|\{display:|font-size:/.test(item.title)))differences.push('template-style-leaked-into-title');
  if(!check.noHorizontalOverflow)differences.push('horizontal-overflow');
  const sourceSummary={title:source.title,markerCount:source.markers.length,validMarkerTargets:source.markers.filter(marker=>marker.target).length,referenceItems:source.references.length,supplements:source.supplements.map(x=>({class:x.class,linkCount:x.linkCount,nested:x.nestedSupplements,examples:x.links.slice(0,3).map(link=>link.text)}))};
  const outputSummary={supplements:output.supplements.map(x=>({title:x.title,open:x.open,navbox:x.class.includes('reader-supplement-navbox'),linkCount:x.links.length,examples:x.links.slice(0,3).map(link=>link.text)})),citationMarkers:output.citationMarkers,referenceBacklinkCount:output.referenceBacklinkCount,contentWidth:output.contentWidth,contentScrollWidth:output.contentScrollWidth};
  results.push({name:item.name,available:true,url:source.url,source:sourceSummary,output:outputSummary,check,differences});
  if(differences.length)throw Error(`${item.name} W04 mismatch: ${JSON.stringify({check,differences,source:sourceSummary.supplements,output:outputSummary.supplements})}`);
 }
 for(const extraPage of page.context().pages())if(extraPage!==page)await extraPage.close();
 await page.unrouteAll();
 return {fixture,results,translation:'disabled; original view only',note:'DOM link and anchor mapping checked; media playback and visual approval are outside this test.'};
}
