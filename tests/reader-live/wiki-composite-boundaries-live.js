async page => {
  const worker=page.context().serviceWorkers()[0];
  if(!worker)throw Error("Native extension service worker required");
  await worker.evaluate(()=>chrome.storage.sync.set({readerView:"orig",autoTranslateEnabled:false}));
  const pages=[
    {name:"Germany",url:"https://en.wikipedia.org/wiki/Germany"},
    {name:"Water",url:"https://en.wikipedia.org/wiki/Water"},
    {name:"Beijing",url:"https://en.wikipedia.org/wiki/Beijing"}
  ];
  const results=[];
  for(const sample of pages){
    const response=await page.goto(sample.url,{waitUntil:"domcontentloaded"});
    const loaded=await page.waitForSelector(".mw-parser-output",{timeout:15000}).then(()=>true).catch(()=>false);
    if(response?.status()!==200||!loaded){results.push({name:sample.name,url:page.url(),status:response?.status()||null,available:false});continue;}
    const source=await page.evaluate(()=>{
      const root=document.querySelector(".mw-parser-output");
      const imageInfo=[...root.querySelectorAll("img")].filter(image=>/flag|map|locator|germany|beijing|china/i.test(`${image.alt} ${image.title} ${image.getAttribute("src")||""}`)).slice(0,24).map(image=>{
        const rect=image.getBoundingClientRect(),parent=image.parentElement,box=parent?.getBoundingClientRect();
        return {alt:image.alt||"",src:image.currentSrc||image.getAttribute("src")||"",width:Math.round(rect.width),height:Math.round(rect.height),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,parent:`${parent?.tagName.toLowerCase()}.${typeof parent?.className==="string"?parent.className.split(/\s+/).slice(0,2).join("."):""}`,position:getComputedStyle(image).position,parentWidth:Math.round(box?.width||0),parentHeight:Math.round(box?.height||0)};
      });
      const candidates=[...root.querySelectorAll("figure,[role=img],[class*=mockup i],[class*=diagram i],div[style*=position]")].map(node=>({tag:node.tagName,classes:typeof node.className==="string"?node.className.split(/\s+/).slice(0,2):[],images:node.querySelectorAll("img").length,absolute:[...node.querySelectorAll("img,div,span")].filter(part=>getComputedStyle(part).position==="absolute").length,textLength:(node.textContent||"").trim().length})).filter(item=>item.absolute>=2&&item.images>0&&item.textLength<1200).slice(0,12);
      return {imageCount:root.querySelectorAll("img").length,keywordImages:imageInfo,compositeCandidates:candidates};
    });
    await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(item=>item.url===url);for(let attempt=0;attempt<15;attempt++){try{await chrome.tabs.sendMessage(tab.id,{action:"TOGGLE_READER_MODE"});return;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},page.url());
    await page.waitForSelector("#reader-content",{timeout:25000});
    const reader=await page.evaluate(()=>{
      const root=document.querySelector("#raccoon-reader-root"),content=root.querySelector("#reader-content");
      const images=[...content.querySelectorAll("img")].filter(image=>/flag|map|locator|germany|beijing|china/i.test(`${image.alt} ${image.title} ${image.src}`)).slice(0,24).map(image=>({alt:image.alt||"",width:Math.round(image.getBoundingClientRect().width),height:Math.round(image.getBoundingClientRect().height),composite:!!image.closest(".reader-composite"),figure:!!image.closest("figure"),classes:image.closest(".reader-img-wrap")?.className||""}));
      return {compositeCount:content.querySelectorAll(".reader-composite").length,keywordImages:images,content:{width:content.clientWidth,scrollWidth:content.scrollWidth},tables:content.querySelectorAll("table").length,figures:content.querySelectorAll(".reader-media-block").length};
    });
    results.push({name:sample.name,url:page.url(),status:response.status(),available:true,source,reader,translation:"disabled; original view only"});
  }
  if(results.some(item=>item.available&&item.reader.content.scrollWidth>item.reader.content.width+1))throw Error(`Composite live sample overflow: ${JSON.stringify(results)}`);
  return {results,openedNewPages:false};
}
