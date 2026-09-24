async page => {
 const worker=page.context().serviceWorkers()[0];
 if(!worker)throw Error('Native extension service worker required');
 await worker.evaluate(()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false,readerWikipediaFlow:false,readerWikipediaMagazine:false}));
 const firstLastRows=(name,total)=>Array.from({length:total-1},(_,index)=>{
  const number=index+1, middle=Math.floor((total-1)/2);
  const marker=number===1?'first':number===total-1?'last':number===middle?'middle':String(number).padStart(3,'0');
  return `<tr><td>${name}-${marker}</td><td>${number.toLocaleString('en-US')}</td><td>2026-09-${String((number%28)+1).padStart(2,'0')}</td><td>sample-${number}</td></tr>`;
 }).join('');
 const table=(name,total,body)=>`<table class="wikitable" id="${name}"><caption>${name}</caption><thead><tr><th>Location</th><th>Population</th><th>Date</th><th>Notes</th></tr></thead><tbody>${body??firstLastRows(name,total)}</tbody></table>`;
 const sized=total=>table(`rows-${total}`,total);
 const largeTextRows=Array.from({length:7},(_,index)=>`<tr><th>Long row ${index}</th><td>${index===0?'LONG-TEXT-START ':''}${'independent sample words '.repeat(110)}${index===6?' LONG-TEXT-END':''}</td></tr>`).join('');
 const foldedRows=['Mean daily maximum °C (°F)|18.4 (65.1)','Mean daily minimum °C (°F)|10.2 (50.4)','Mean monthly sunshine hours|166.5','Average precipitation days|8.1','Station period|1991–2020'].map((value,index)=>{
  const [label,reading]=value.split('|');
  return `<tr hidden="until-found"><th>${label}</th><td style="background-color:${index===0?'rgb(150, 20, 10)':'transparent'}">${reading}</td></tr>`;
 }).join('');
 const colspanRows='<tr><th colspan="3">Combined annual summary</th></tr><tr><th rowspan="2">Month</th><td style="background-color:rgb(150, 20, 10);color:white">October</td><td>12 °C</td></tr><tr><td>November</td><td>8 °C</td></tr>';
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Reader table fixture</title></head><body><div id="mw-content-text"><main class="mw-parser-output"><h1>Reader table fixture</h1><p>This self-authored page checks bounded semantic table extraction and keeps later records available to the reader.</p><h2>Tables</h2>${sized(79)}${sized(80)}${sized(81)}${sized(242)}${table('long-text',8,largeTextRows)}<table class="wikitable mw-collapsible mw-collapsed" id="folded-climate"><caption>Fixture climate station · 1991–2020 · °C</caption><thead><tr><th>Station field</th><th>January</th></tr></thead><tbody><tr><th colspan="2">Station summary toggle</th></tr>${foldedRows}</tbody></table><table class="wikitable" id="merged-cells"><caption>Merged and colored values</caption><tbody>${colspanRows}</tbody></table></main></div></body></html>`;
 const url='https://en.wikipedia.org/wiki/Reader_Long_Table_Fixture';
 await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.setViewportSize({width:820,height:900});
 const response=await page.goto(url,{waitUntil:'domcontentloaded'});
 const source=await page.evaluate(()=>[...document.querySelectorAll('.mw-parser-output table')].map(t=>({id:t.id,rows:t.rows.length,textLength:t.textContent.trim().length,hiddenRows:[...t.rows].filter(row=>row.hidden).length,cells:[...t.rows].reduce((sum,row)=>sum+row.cells.length,0)})));
 await worker.evaluate(async targetUrl=>{const target=(await chrome.tabs.query({})).find(tab=>tab.url===targetUrl);for(let attempt=0;attempt<15;attempt++){try{await chrome.tabs.sendMessage(target.id,{action:'TOGGLE_READER_MODE'});return;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},page.url());
 await page.waitForSelector('#reader-content',{timeout:25000});
 const reader=await page.evaluate(()=>{
  const content=document.querySelector('#reader-content'),root=document.querySelector('#raccoon-reader-root');
  return {
   tables:[...content.querySelectorAll('.reader-data-table')].map(block=>{
    const table=block.querySelector('.reader-semantic-table'),details=block.querySelector('.reader-table-details');
    return {label:block.querySelector('.reader-table-heading span')?.textContent.trim(),rows:table?.rows.length||0,details:details?{open:details.open,summary:details.querySelector('summary')?.textContent.trim()}:null,text:table?.textContent||''};
   }),
   spans:[...content.querySelectorAll('.reader-semantic-table [colspan],.reader-semantic-table [rowspan]')].filter(cell=>Number(cell.getAttribute('colspan'))>1||Number(cell.getAttribute('rowspan'))>1).map(cell=>({tag:cell.tagName,colspan:cell.getAttribute('colspan'),rowspan:cell.getAttribute('rowspan')})),
   colored:[...content.querySelectorAll('.reader-semantic-table [data-reader-source-color]')].map(cell=>({background:getComputedStyle(cell).backgroundColor,ink:getComputedStyle(cell).color})),
   contentOverflow:content.scrollWidth>content.clientWidth+1,
   tableStyle:root.dataset.tableStyle
  };
 });
 const expected=['rows-79-first','rows-79-middle','rows-79-last','rows-80-first','rows-80-middle','rows-80-last','rows-81-first','rows-81-middle','rows-81-last','rows-242-first','rows-242-middle','rows-242-last','LONG-TEXT-START','LONG-TEXT-END','Mean daily maximum °C (°F)','18.4 (65.1)','Station period','1991–2020'];
 const missing=expected.filter(marker=>!reader.tables.some(block=>block.text.includes(marker)));
 const byLabel=new Map(reader.tables.map(block=>[block.label,block]));
 for(const label of ['rows-79','rows-80','rows-81','rows-242','long-text','Fixture climate station · 1991–2020 · °C']){
  const block=byLabel.get(label);if(!block)throw Error('Fixture table missing: '+label);
  if(['rows-81','rows-242','long-text','Fixture climate station · 1991–2020 · °C'].includes(label)&&(!block.details||block.details.open))throw Error('Expected bounded collapsed disclosure for '+label+': '+JSON.stringify(block.details));
 }
 if(missing.length)throw Error('Reader lost unique table records: '+missing.join(', '));
 if(byLabel.get('rows-242').rows!==242)throw Error('242-row table count changed: '+byLabel.get('rows-242').rows);
 if(!reader.spans.some(cell=>cell.colspan==='3')||!reader.spans.some(cell=>cell.rowspan==='2'))throw Error('Row or column span lost: '+JSON.stringify(reader.spans));
 if(reader.colored.length<2||reader.colored.some(cell=>cell.background!=='rgb(150, 20, 10)'))throw Error('Source color lost: '+JSON.stringify(reader.colored));
 if(reader.contentOverflow)throw Error('Table widened the reader content instead of its own scroll region');
 if(response?.status()!==200)throw Error('Fixture page unavailable: '+response?.status());
 const disclosures=page.locator('#reader-content .reader-table-details');
 if(await disclosures.count()!==4)throw Error('Expected four bounded/source-folded disclosures, found '+await disclosures.count());
 for(let index=0;index<await disclosures.count();index++){
  const disclosure=disclosures.nth(index);if(await disclosure.getAttribute('open')!==null)throw Error('Disclosure opened by default: '+index);
  await disclosure.locator('summary').click();if(await disclosure.getAttribute('open')===null)throw Error('Disclosure did not open: '+index);
 }
 const openedRows=await page.locator('.reader-table-details[open] .reader-semantic-table').evaluateAll(tables=>tables.map(table=>table.rows.length));
 if(!openedRows.includes(242)||!openedRows.includes(81))throw Error('Full table rows unavailable after expanding: '+JSON.stringify(openedRows));
 const wideScroll=await page.locator('.reader-table-details[open] .reader-table-scroll').evaluateAll(nodes=>nodes.some(node=>node.scrollWidth>node.clientWidth+1));
 if(!wideScroll)throw Error('Long table did not scroll inside its own region');
 if(!await page.locator('#reader-btn-open-settings').isVisible())throw Error('Reader settings control unavailable');
 await page.locator('#reader-btn-open-settings').click();await page.locator('[data-reader-tool-tab="style"]').click();
 const colorCell=page.locator('#reader-content [data-reader-source-color]').first();
 for(const style of ['three-line','striped','clean']){
  await page.locator(`[data-reader-table-style="${style}"]`).click();
  if(await colorCell.evaluate(cell=>getComputedStyle(cell).backgroundColor)!=='rgb(150, 20, 10)')throw Error('Source color changed in '+style+' style');
 }
 return {source,reader:{...reader,tables:reader.tables.map(({text,...item})=>item),openedRows,wideScroll},passed:true,translation:'disabled; original view only'};
}
