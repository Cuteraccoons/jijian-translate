async page => {
 const worker=page.context().serviceWorkers()[0];
 if(!worker)throw Error('Native extension service worker required');
 await worker.evaluate(()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false}));
 await page.setViewportSize({width:1120,height:900});
 const openReader=async()=>{await worker.evaluate(async url=>{const target=(await chrome.tabs.query({})).find(tab=>tab.url===url);for(let attempt=0;attempt<15;attempt++){try{await chrome.tabs.sendMessage(target.id,{action:'TOGGLE_READER_MODE'});return;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},page.url());await page.waitForSelector('#reader-content',{timeout:30000});};
 const populationUrl='https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population';
 const populationResponse=await page.goto(populationUrl,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForSelector('#mw-content-text .mw-parser-output table.wikitable',{timeout:25000});
 const populationSource=await page.evaluate(()=>{
  const table=document.querySelector('#mw-content-text .mw-parser-output table.wikitable');
  const rows=[...table.rows].filter(row=>row.textContent.trim());
  const pick=label=>rows.find(row=>row.textContent.includes(label));
  return {id:table.id,classes:table.className,rowCount:table.rows.length,meaningfulRows:rows.length,emptyRows:[...table.rows].filter(row=>row.classList.contains('mw-empty-elt')&&!row.textContent.trim()).length,textLength:table.textContent.trim().length,caption:table.querySelector('caption')?.textContent.trim(),samples:['World','Norway','Pitcairn Islands (UK)'].map(label=>{const row=pick(label);return {label,cells:[...row.cells].slice(0,4).map(cell=>cell.textContent.replace(/\s+/g,' ').trim())};})};
 });
 await openReader();
 const populationReader=await page.evaluate(()=>{
  const block=document.querySelector('#reader-content .reader-data-table'),table=block?.querySelector('.reader-semantic-table'),details=block?.querySelector('.reader-table-details');
  const rowFor=label=>[...table.rows].find(row=>row.textContent.includes(label));
  return {blockCount:document.querySelectorAll('#reader-content .reader-data-table').length,rowCount:table?.rows.length||0,reason:details?.dataset.readerTableReason||null,open:details?.open??null,samples:['World','Norway','Pitcairn Islands (UK)'].map(label=>{const row=rowFor(label);return {label,cells:row?[...row.cells].map(cell=>cell.querySelector('.reader-orig-p')?.textContent.replace(/\s+/g,' ').trim()||cell.textContent.replace(/\s+/g,' ').trim()).slice(0,4):[]};})};
 });
 if(populationResponse?.status()!==200)throw Error('Population page unavailable: '+populationResponse?.status());
 if(populationSource.rowCount!==242||populationSource.meaningfulRows!==241||populationSource.emptyRows!==1||populationReader.rowCount!==populationSource.meaningfulRows)throw Error('Population table row count mismatch: '+JSON.stringify({source:populationSource,reader:populationReader.rowCount}));
 if(populationReader.reason!=='complete-data'||populationReader.open!==false)throw Error('Population table is not a closed complete-data disclosure: '+JSON.stringify(populationReader));
 for(let i=0;i<populationSource.samples.length;i++){
  const source=populationSource.samples[i],reader=populationReader.samples[i];
  if(source.cells.slice(0,2).join('|')!==reader.cells.slice(0,2).join('|'))throw Error('Population record mismatch: '+JSON.stringify({source,reader}));
 }
 await page.locator('#reader-content .reader-table-details summary').first().click();
 if(await page.locator('#reader-content .reader-table-details').first().getAttribute('open')===null)throw Error('Population disclosure did not open');
 const populationExpanded=await page.locator('#reader-content .reader-data-table .reader-semantic-table').first().evaluate(table=>({rows:table.rows.length,first:table.rows[1]?.textContent.includes('World')||false,last:[...table.rows].at(-1)?.textContent.includes('Pitcairn Islands (UK)')||false}));
 if(populationExpanded.rows!==populationSource.meaningfulRows||!populationExpanded.first||!populationExpanded.last)throw Error('Population first/last records unavailable after expansion: '+JSON.stringify(populationExpanded));

 const climateUrl='https://en.wikipedia.org/wiki/Climate_of_London';
 const climateResponse=await page.goto(climateUrl,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForSelector('#mw-content-text .mw-parser-output table.wikitable',{timeout:25000});
 await page.waitForTimeout(500);
 const climateSource=await page.evaluate(()=>{
  const tables=[...document.querySelectorAll('#mw-content-text .mw-parser-output table.wikitable')].filter(table=>!table.closest('.navbox,.sistersitebox'));
  return tables.map(table=>{
   const rows=[...table.rows].filter(row=>row.textContent.trim());
   const center=Math.floor(rows.length/2);
   const sampleIndexes=[0,Math.min(1,rows.length-1),center,rows.length-1];
   const clean=cell=>{
    const clone=cell.cloneNode(true),sourceElements=[...cell.querySelectorAll('*')],cloneElements=[...clone.querySelectorAll('*')];
    sourceElements.forEach((source,index)=>{const copy=cloneElements[index],css=getComputedStyle(source);if(copy&&(source.hidden||source.getAttribute('aria-hidden')==='true'||css.display==='none'||css.visibility==='hidden'))copy.remove();});
    clone.querySelectorAll('style,script,noscript,.navbar,.mw-collapsible-toggle').forEach(node=>node.remove());
    return clone.textContent.replace(/^\s*(?:show|hide|v\s*t\s*e)\s*/i,'').replace(/\s+/g,' ').trim().slice(0,70);
   };
   return {id:table.id,classes:table.className,rowCount:rows.length,hiddenRows:rows.filter(row=>row.hidden).length,textLength:table.textContent.trim().length,caption:table.querySelector('caption')?.textContent.replace(/\s+/g,' ').trim()||'',station:clean(rows[0]?.cells?.[0]||document.createElement('td')).slice(0,100),samples:sampleIndexes.map(index=>[...rows[index].cells].slice(0,2).map(clean))};
  });
 });
 await openReader();
 const climateReader=await page.evaluate(()=>[...document.querySelectorAll('#reader-content .reader-data-table')].filter(block=>!block.closest('.reader-supplement')).map(block=>{
  const table=block.querySelector('.reader-semantic-table'),details=block.querySelector('.reader-table-details');
  return {label:block.querySelector('.reader-table-heading span')?.textContent.trim(),firstCell:table?.rows[0]?.cells[0]?.querySelector('.reader-orig-p')?.textContent.replace(/\s+/g,' ').trim()||'',rowCount:table?.rows.length||0,reason:details?.dataset.readerTableReason||null,open:details?.open??null,text:table?.textContent||''};
 }));
 if(climateResponse?.status()!==200)throw Error('London climate page unavailable: '+climateResponse?.status());
 if(climateSource.length!==climateReader.length)throw Error('Climate table count mismatch: '+JSON.stringify({source:climateSource.length,reader:climateReader.length}));
 const climateComparison=climateSource.map((source,index)=>{
  const reader=climateReader[index];
  const expectedSamples=source.samples.flat().filter(Boolean);
  const missingSamples=expectedSamples.filter(value=>!reader.text.replace(/\s+/g,'').includes(value.replace(/\s+/g,'')));
  if(source.rowCount!==reader.rowCount||missingSamples.length)throw Error('Climate table content mismatch at '+index+': '+JSON.stringify({source,reader:{...reader,text:undefined},missingSamples}));
  if(source.classes.includes('mw-collapsed')&&(reader.reason!=='source-collapsed'||reader.open!==false))throw Error('Collapsed climate table state lost at '+index+': '+JSON.stringify({source,reader:{...reader,text:undefined}}));
  if(/^(?:show|hide)/i.test(reader.firstCell))throw Error('Source table toggle leaked into data row at '+index+': '+reader.firstCell);
  return {index,sourceRows:source.rowCount,readerRows:reader.rowCount,sourceHiddenRows:source.hiddenRows,classes:source.classes,caption:source.caption||source.station,readerLabel:reader.label,firstRowCell:reader.firstCell,firstTwoColumns:source.samples[1]||source.samples[0],matchedSampleCells:expectedSamples.length,disclosure:reader.reason};
 });
 const collapsed=page.locator('#reader-content .reader-table-details[data-reader-table-reason="source-collapsed"]');
 const collapsedCount=await collapsed.count();
 if(collapsedCount<1)throw Error('No reader disclosures for collapsed climate tables');
 await collapsed.first().locator('summary').click();
 if(await collapsed.first().getAttribute('open')===null)throw Error('Climate table disclosure did not open');
 const tableColors=page.locator('#reader-content [data-reader-source-color]');
 const coloredCount=await tableColors.count();
 if(coloredCount<1)throw Error('London climate source data colors were not preserved');
 await page.locator('#reader-btn-open-settings').click();await page.locator('[data-reader-tool-tab="style"]').click();
 for(const style of ['three-line','striped','clean']){
  await page.locator(`[data-reader-table-style="${style}"]`).click();
  const colorState=await tableColors.evaluateAll(cells=>cells.map(cell=>({background:getComputedStyle(cell).backgroundColor,ink:getComputedStyle(cell).color,source:cell.dataset.readerSourceColor})));
  if(colorState.some(cell=>!cell.source||cell.background==='rgba(0, 0, 0, 0)'))throw Error('Climate data color lost in '+style+' style: '+JSON.stringify(colorState.slice(0,3)));
 }
 const outline=page.locator('#reader-outline-panel .reader-outline-item').first();
 if(await outline.count()){
  const targetId=await outline.getAttribute('data-target-id');await outline.click();
  const target=page.locator('#'+targetId);if(!await target.count())throw Error('Outline target missing after table toggle: '+targetId);
  let geometry=null,previousTop=null,stableFrames=0;
  for(let attempt=0;attempt<16&&stableFrames<3;attempt++){
   await page.waitForTimeout(100);
   geometry=await page.evaluate(id=>{const area=document.querySelector('#reader-scroll-area'),target=document.getElementById(id);const a=area.getBoundingClientRect(),t=target.getBoundingClientRect();return {top:t.top-a.top,bottom:t.bottom-a.top,height:a.height};},targetId);
   stableFrames=previousTop!==null&&Math.abs(geometry.top-previousTop)<1?stableFrames+1:0;previousTop=geometry.top;
  }
  if(geometry.top < -20||geometry.top>geometry.height-40)throw Error('Outline target not brought into view after table disclosure: '+JSON.stringify(geometry));
 }
 const noPageOverflow=await page.locator('#reader-content').evaluate(content=>content.scrollWidth<=content.clientWidth+1);
 if(!noPageOverflow)throw Error('Climate table widened the article content');
 return {population:{url:populationUrl,status:populationResponse?.status(),physicalSourceRows:populationSource.rowCount,meaningfulSourceRows:populationSource.meaningfulRows,emptySpacerRows:populationSource.emptyRows,sourceChars:populationSource.textLength,readerRows:populationReader.rowCount,disclosure:populationReader.reason,records:populationSource.samples.map((source,index)=>({label:source.label,population:source.cells[1],date:source.cells[3],readerMatches:source.cells.slice(0,2).join('|')===populationReader.samples[index].cells.slice(0,2).join('|')})),expanded:populationExpanded},climate:{url:climateUrl,status:climateResponse?.status(),tables:climateComparison,sourceColoredCells:coloredCount,collapsedTables:collapsedCount,outlineChecked:await outline.count()>0,noPageOverflow,translation:'disabled; original view only'}};
}
