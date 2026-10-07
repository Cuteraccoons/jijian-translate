async page=>{
 const worker=page.context().serviceWorkers()[0];
 if(!worker)throw Error('Native extension service worker required');
 await worker.evaluate(async()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false}));
 await page.setViewportSize({width:1440,height:1000});
 const toggle=async tabUrl=>worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).filter(t=>t.url===url).at(-1);if(!tab)throw Error('Current extension tab not found');for(let i=0;i<15;i++){try{await chrome.tabs.sendMessage(tab.id,{action:'TOGGLE_READER_MODE'});return;}catch(error){if(i===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},tabUrl);
 for(const oldPage of page.context().pages().filter(item=>item!==page&&item.url().includes('/wiki/W07_code_fixture')))await oldPage.close();
 const fixturePage=page;
 const expected='def lookup(value):\n\tif value < 4:\n\t\treturn "<tag>"\n\n\treturn value';
 await fixturePage.route('https://en.wikipedia.org/wiki/W07_code_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Code fixture</title></head><body><main id="mw-content-text"><div class="mw-parser-output"><h1>Code fixture</h1><p>Small code fixture with enough article prose to be retained in the reader view.</p><pre><code>${expected.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</code></pre><pre><code>plain text\n  second line\n\n  last line</code></pre><table class="wikitable"><tbody><tr><th>Example</th></tr><tr><td><pre><code>${expected.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</code></pre></td></tr></tbody></table></div></main></body></html>`}));
 await fixturePage.goto('https://en.wikipedia.org/wiki/W07_code_fixture',{waitUntil:'domcontentloaded'});
 await toggle(fixturePage.url());
 await fixturePage.waitForSelector('#raccoon-reader-root #reader-content',{timeout:20000});
 const fixture=await fixturePage.evaluate(()=>({source:[...document.querySelectorAll('#mw-content-text pre')].filter(pre=>!pre.closest('table')).map(pre=>pre.textContent),tableSource:[...document.querySelectorAll('#mw-content-text table pre')].map(pre=>pre.textContent),output:[...document.querySelectorAll('#reader-content .reader-code-block .reader-orig-p')].map(pre=>pre.textContent),tableOutput:[...document.querySelectorAll('#reader-content .reader-semantic-table code.reader-inline-code-block')].map(pre=>pre.textContent),codeBlocks:document.querySelectorAll('#reader-content .reader-code-block').length,overflow:document.querySelector('#reader-content').scrollWidth-document.querySelector('#reader-content').clientWidth}));
 const fixturePass=fixture.source.length===2&&fixture.output.length===2&&fixture.source.every((text,index)=>text===fixture.output[index])&&fixture.source[0]===expected&&fixture.tableSource.length===1&&fixture.tableOutput.length===1&&fixture.tableSource[0]===fixture.tableOutput[0]&&fixture.overflow===0;
 if(!fixturePass)throw Error(`W07b whitespace fixture mismatch: ${JSON.stringify(fixture)}`);
 let response;
 try{response=await page.goto('https://en.wikipedia.org/wiki/Python_(programming_language)',{waitUntil:'domcontentloaded',timeout:35000});await page.waitForSelector('#mw-content-text .mw-parser-output',{timeout:15000});}
 catch(error){return {fixture,live:{available:false,status:response?.status()||null,reason:String(error).slice(0,180)},translation:'disabled'};}
 const source=await page.evaluate(()=>[...document.querySelectorAll('#mw-content-text .mw-parser-output pre')].map((pre,index)=>({index,text:pre.textContent,insideHighlight:!!pre.closest('.mw-highlight'),chars:pre.textContent.length,hasLineNumbers:!!pre.querySelector('.hljs-ln-numbers,.linenos')})));
 if(response?.status()!==200)return {fixture,live:{available:false,status:response?.status()||null},translation:'disabled'};
 await toggle(page.url());
 await page.waitForSelector('#raccoon-reader-root #reader-content',{timeout:35000});
 const output=await page.evaluate(()=>({blocks:[...document.querySelectorAll('#reader-content .reader-code-block')].map((block,index)=>({index,text:block.querySelector('.reader-orig-p')?.textContent||'',chars:block.querySelector('.reader-orig-p')?.textContent.length||0,wrapperText:block.textContent.slice(0,120)})),inlineBlocks:[...document.querySelectorAll('#reader-content code.reader-inline-code-block')].map((block,index)=>({index,text:block.textContent,chars:block.textContent.length})),overflow:document.querySelector('#reader-content').scrollWidth-document.querySelector('#reader-content').clientWidth,contentWidth:document.querySelector('#reader-content').clientWidth}));
 const allOutput=[...output.blocks,...output.inlineBlocks];
 const matches=source.map(sourceBlock=>{const exact=allOutput.find(block=>block.text===sourceBlock.text);const normalized=allOutput.find(block=>block.text.replace(/\n$/,'')===sourceBlock.text.replace(/\n$/,''));return {sourceIndex:sourceBlock.index,chars:sourceBlock.chars,insideHighlight:sourceBlock.insideHighlight,exactOutput:!!exact,oneFinalNewlineOnly:!exact&&!!normalized,sample:sourceBlock.text.slice(0,100)};});
 const lost=matches.filter(match=>!match.exactOutput&&!match.oneFinalNewlineOnly);
 await page.unrouteAll();
 return {fixture,live:{available:true,status:response.status(),url:page.url(),sourcePreCount:source.length,readerCodeBlockCount:output.blocks.length,tableCodeBlockCount:output.inlineBlocks.length,matches,blocks:allOutput.map(block=>({chars:block.chars,sample:block.text.slice(0,100)})),lost,horizontalOverflow:output.overflow,contentWidth:output.contentWidth},translation:'disabled; original view only'};
}
