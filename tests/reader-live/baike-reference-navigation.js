async page => {
  const worker=page.context().serviceWorkers()[0];
  if(!worker)throw Error("Native extension service worker required");
  await worker.evaluate(()=>chrome.storage.sync.set({readerView:"orig",autoTranslateEnabled:false,readerOutlineCollapsed:false}));
  await page.setViewportSize({width:1280,height:900});
  await page.unrouteAll();
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>百科脚注跳转样例</title></head><body><main class="J-lemma-content">
    <h1>百科脚注跳转样例</h1>
    <p id="claim-one">First claim states a verified fact and keeps its source marker attached to the sentence.<sup><a href="#baike-ref-1">[1]</a></sup></p>
    <p id="claim-two">A second claim points to a named anchor inside the next source entry.<sup><a href="#baike-ref-2">[2]</a></sup></p>
    <p>Another claim cites a missing target, which should remain an ordinary source link without a fabricated destination.<sup><a href="#missing-ref">[99]</a></sup></p>
    ${Array.from({length:28},(_,index)=>`<p>Intervening article paragraph ${index+1} keeps the reference section far below the citation.</p>`).join("")}
    <h2>参考资料</h2><ol>
      <li id="baike-ref-1">First source entry.<a class="reference-backlink" href="#claim-one">↩ Return to text</a></li>
      <li>Second source entry.<a name="baike-ref-2"></a></li>
    </ol>
    ${Array.from({length:20},(_,index)=>`<p>Following article note ${index+1} leaves room to align the selected reference near the top.</p>`).join("")}
  </main></body></html>`;
  await page.route("https://baike.baidu.com/item/Reference_Navigation_Fixture",route=>route.fulfill({status:200,contentType:"text/html",body:html}));
  const response=await page.goto("https://baike.baidu.com/item/Reference_Navigation_Fixture",{waitUntil:"domcontentloaded"});
  const source=await page.evaluate(()=>({marker:document.querySelector('a[href="#baike-ref-1"]')?.getAttribute("href"),referenceId:document.querySelector('#baike-ref-1')?.id,referenceName:document.querySelector('a[name="baike-ref-2"]')?.getAttribute("name"),backlink:document.querySelector('.reference-backlink')?.getAttribute("href")}));
  await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(item=>item.url===url);for(let attempt=0;attempt<15;attempt++){try{await chrome.tabs.sendMessage(tab.id,{action:"TOGGLE_READER_MODE"});return;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},page.url());
  await page.waitForSelector("#raccoon-reader-root .reader-baike-references");
  const referenceDetails=page.locator("#reader-content .reader-baike-references");
  const initiallyCollapsed=!(await referenceDetails.evaluate(node=>node.open));
  const forward=await page.locator('#reader-content .reader-orig-p a[href$="#baike-ref-1"]').evaluate(link=>{const event=new MouseEvent("click",{bubbles:true,cancelable:true});link.dispatchEvent(event);return {prevented:event.defaultPrevented,href:link.href};});
  await page.waitForFunction(()=>document.querySelector("#reader-content .reader-baike-references")?.open===true);
  await page.waitForTimeout(800);
  const forwardTarget=await page.evaluate(()=>{const row=document.querySelector('#reader-content .reader-baike-references li[id^="reader_baike_reference_"]'),area=document.querySelector('#reader-scroll-area');return {exists:!!row,top:row?.getBoundingClientRect().top-area.getBoundingClientRect().top,areaHeight:area.clientHeight,open:document.querySelector('#reader-content .reader-baike-references')?.open};});
  const namedForward=await page.locator('#reader-content .reader-orig-p a[href$="#baike-ref-2"]').evaluate(link=>{const event=new MouseEvent("click",{bubbles:true,cancelable:true});link.dispatchEvent(event);return {prevented:event.defaultPrevented,href:link.href};});
  await page.waitForTimeout(800);
  const namedForwardTarget=await page.evaluate(()=>{const row=[...document.querySelectorAll('#reader-content .reader-baike-references li[id^="reader_baike_reference_"]')].find(item=>item.id.endsWith("_1")),area=document.querySelector('#reader-scroll-area');return {exists:!!row,top:row?.getBoundingClientRect().top-area.getBoundingClientRect().top,areaHeight:area.clientHeight};});
  const backlink=await page.locator('#reader-content .reader-baike-references li a[href$="#claim-one"]').evaluate(link=>{const event=new MouseEvent("click",{bubbles:true,cancelable:true});link.dispatchEvent(event);return {prevented:event.defaultPrevented,href:link.href};});
  await page.waitForTimeout(800);
  const returnTarget=await page.evaluate(()=>{const block=[...document.querySelectorAll('#reader-content .reader-paragraph-pair')].find(node=>node.querySelector('.reader-orig-p')?.id==='claim-one'||node.querySelector('.reader-orig-p')?.textContent.includes('First claim states'));const area=document.querySelector('#reader-scroll-area');return {exists:!!block,top:block?.getBoundingClientRect().top-area.getBoundingClientRect().top,areaHeight:area.clientHeight};});
  const missing=await page.locator('#reader-content .reader-orig-p a[href$="#missing-ref"]').evaluate(link=>({href:link.href,target:link.target,targetExists:!!document.querySelector('#raccoon-reader-root #missing-ref')}));
  await referenceDetails.locator('summary').click();
  await page.waitForFunction(()=>document.querySelector('#reader-content .reader-baike-references')?.open===false);
  const translatedCitation=await page.evaluate(()=>{
    const pair=[...document.querySelectorAll('#reader-content .reader-paragraph-pair')].find(node=>node.querySelector('.reader-orig-p')?.textContent.includes('First claim states'));
    const translated=pair?.querySelector('.reader-trans-p');
    const sup=document.createElement('sup');sup.className='raccoon-citation';
    const link=document.createElement('a');link.href='#baike-ref-1';link.target='_blank';link.rel='noopener noreferrer';link.textContent='[1]';sup.append(link);
    translated?.replaceChildren(document.createTextNode('第一条陈述保留来源标记'),sup);
    const event=new MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);
    return {prevented:event.defaultPrevented,href:link.href,hasSuperscript:!!translated?.querySelector('.raccoon-citation a')};
  });
  await page.waitForFunction(()=>document.querySelector('#reader-content .reader-baike-references')?.open===true);
  await page.waitForTimeout(800);
  const translatedTarget=await page.evaluate(()=>{const row=document.querySelector('#reader-content .reader-baike-references li[id^="reader_baike_reference_"]'),area=document.querySelector('#reader-scroll-area');return {exists:!!row,top:row?.getBoundingClientRect().top-area.getBoundingClientRect().top,areaHeight:area.clientHeight};});
  const forwardPass=forward.prevented&&forward.href.endsWith('#baike-ref-1')&&forwardTarget.exists&&forwardTarget.open&&forwardTarget.top>=-2&&forwardTarget.top<120;
  const returnPass=backlink.prevented&&backlink.href.endsWith('#claim-one')&&returnTarget.exists&&returnTarget.top>=-2&&returnTarget.top<120;
  const missingPass=missing.href.endsWith('#missing-ref')&&missing.target==='_blank'&&!missing.targetExists;
  const translatedPass=translatedCitation?.prevented&&translatedCitation.hasSuperscript&&translatedCitation.href.endsWith('#baike-ref-1')&&translatedTarget?.exists&&translatedTarget.top>=-2&&translatedTarget.top<120;
  const namedForwardPass=namedForward.prevented&&namedForward.href.endsWith("#baike-ref-2")&&namedForwardTarget.exists&&namedForwardTarget.top>=-2&&namedForwardTarget.top<120;
  const assertions={sourceFixtureValid:response?.status()===200&&source.marker==="#baike-ref-1"&&source.referenceId==="baike-ref-1"&&source.referenceName==="baike-ref-2"&&source.backlink==="#claim-one",referencesInitiallyCollapsed:initiallyCollapsed,forwardCitationOpensAndJumps:forwardPass,namedAnchorCitationJumpsToSecondReference:namedForwardPass,referenceBacklinkReturnsToText:returnPass,missingReferenceRemainsUnmapped:missingPass,translatedCitationAlsoJumps:translatedPass};
  await page.unrouteAll();
  if(Object.values(assertions).some(value=>!value))throw Error(`Baike reference navigation failed: ${JSON.stringify({assertions,forward,forwardTarget,backlink,returnTarget,missing})}`);
  return {status:response?.status(),source,initiallyCollapsed,forward,forwardTarget,namedForward,namedForwardTarget,backlink,returnTarget,missing,translatedCitation,translatedTarget,assertions,translation:"not invoked; translated citation link shape tested directly"};
}
