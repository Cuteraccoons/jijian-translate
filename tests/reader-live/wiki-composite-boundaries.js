async page => {
  const worker=page.context().serviceWorkers()[0];
  if(!worker)throw Error("Native extension service worker required");
  await worker.evaluate(()=>chrome.storage.sync.set({readerView:"orig",autoTranslateEnabled:false}));
  await page.unrouteAll();
  const svg=(width,height,color,label)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${color}"/><text x="8" y="${Math.min(height-8,28)}" font-size="14" fill="white">${label}</text></svg>`)}`;
  const flagA=svg(160,100,"#315a8c","A"),flagB=svg(160,100,"#4d7658","B"),map=svg(520,360,"#bba981","Map"),plateA=svg(640,420,"#776b65","Plate A"),plateB=svg(640,420,"#6c7892","Plate B"),strip=svg(1600,90,"#56736e","Long strip"),icon=svg(24,24,"#303943","i");
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Composite boundary fixture</title></head><body><main><div class="mw-parser-output">
    <h1>Composite boundary fixture</h1><p>A compact test article checks composite figures, separate image captions and image size classification.</p>
    <figure id="flag-map-group" style="position:relative;width:600px;height:260px;margin:0;border:1px solid #777;overflow:hidden">
      <img alt="Region A flag" src="${flagA}" style="position:absolute;left:30px;top:24px;width:96px;height:60px;object-fit:cover">
      <img alt="Region B flag" src="${flagB}" style="position:absolute;left:150px;top:24px;width:96px;height:60px;object-fit:cover">
      <img alt="Locator map" src="${map}" style="position:absolute;left:320px;top:18px;width:250px;height:174px;object-fit:contain">
      <span style="position:absolute;left:32px;top:96px;width:110px;height:24px">Region A label</span>
      <span style="position:absolute;left:152px;top:96px;width:110px;height:24px">Region B label</span>
      <span style="position:absolute;left:324px;top:202px;width:220px;height:24px">Northern locator label</span>
      <figcaption>Two flags and a locator map</figcaption>
    </figure>
    <figure><img alt="Plate A" src="${plateA}" width="640" height="420"><figcaption>Caption belongs to plate A</figcaption></figure>
    <figure><img alt="Plate B" src="${plateB}" width="640" height="420"><figcaption>Caption belongs to plate B</figcaption></figure>
    <p><img alt="Historical long strip" src="${strip}" style="width:600px;height:34px;object-fit:contain"></p>
    <p><img alt="Location icon" src="${icon}" width="24" height="24"></p>
  </div></main></body></html>`;
  await page.route("https://en.wikipedia.org/wiki/Composite_Boundary_Fixture",route=>route.fulfill({status:200,contentType:"text/html",body:html}));
  const response=await page.goto("https://en.wikipedia.org/wiki/Composite_Boundary_Fixture",{waitUntil:"domcontentloaded"});
  const toggle=async()=>worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(item=>item.url===url);for(let attempt=0;attempt<15;attempt++){try{await chrome.tabs.sendMessage(tab.id,{action:"TOGGLE_READER_MODE"});return;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}},page.url());
  const inspectSource=()=>page.evaluate(()=>{const group=document.querySelector("#flag-map-group");const origin=group.getBoundingClientRect();const points=[...group.querySelectorAll("img,span")].filter(node=>node.tagName==="IMG"||node.textContent.includes("label")).map(node=>{const box=node.getBoundingClientRect();return {label:node.alt||node.textContent.trim(),x:(box.left-origin.left)/origin.width,y:(box.top-origin.top)/origin.height,width:box.width/origin.width,height:box.height/origin.height};});return points;});
  const sourceGeometry=await inspectSource();
  await toggle();
  await page.waitForSelector("#reader-content .reader-composite");
  const inspectReader=()=>page.evaluate(()=>{
    const root=document.querySelector("#raccoon-reader-root"),content=root.querySelector("#reader-content"),group=root.querySelector(".reader-composite"),stage=group?.querySelector(".reader-composite-stage");
    const outer=group?.getBoundingClientRect();
    const points=[...(stage?.querySelectorAll("img,span")||[])].filter(node=>node.tagName==="IMG"||node.textContent.includes("label")).map(node=>{const box=node.getBoundingClientRect();return {label:node.alt||node.textContent.trim(),x:(box.left-outer.left)/outer.width,y:(box.top-outer.top)/outer.height,width:box.width/outer.width,height:box.height/outer.height};});
    const captions=[...root.querySelectorAll(".reader-media-block")].map(figure=>({image:figure.querySelector("img")?.alt||"",caption:figure.querySelector(".reader-figcaption .reader-orig-p")?.textContent.trim()||""}));
    const strip=root.querySelector('.reader-img-wrap img[alt="Historical long strip"]'),stripWrap=strip?.closest(".reader-img-wrap"),contentWidth=content.clientWidth;
    return {points,composite:{width:group?.clientWidth||0,scrollWidth:group?.scrollWidth||0,sourceWidth:Number(group?.dataset.compositeWidth)||0,sourceHeight:Number(group?.dataset.compositeHeight)||0},captions,strip:{found:!!strip,wide:stripWrap?.classList.contains("reader-img-wide")||false,width:strip?.getBoundingClientRect().width||0,height:strip?.getBoundingClientRect().height||0},iconCount:root.querySelectorAll('#reader-content img[alt="Location icon"]').length,content:{width:contentWidth,scrollWidth:content.scrollWidth}};
  });
  const wide=await inspectReader();
  await page.setViewportSize({width:390,height:900});
  await page.waitForTimeout(180);
  const narrow=await inspectReader();
  const pointsMatch=(expected,actual)=>expected.length===actual.length&&expected.every((point,index)=>Math.abs(point.x-actual[index].x)<.025&&Math.abs(point.y-actual[index].y)<.025);
  const captionsPass=wide.captions.some(item=>item.image==="Plate A"&&item.caption==="Caption belongs to plate A")&&wide.captions.some(item=>item.image==="Plate B"&&item.caption==="Caption belongs to plate B");
  const assertions={fixtureLoaded:response?.status()===200,compositeContainsThreeImagesAndLabels:wide.points.length===6&&wide.points.some(point=>point.label==="Locator map"),layerGeometryPreserved:pointsMatch(sourceGeometry,wide.points)&&pointsMatch(wide.points,narrow.points),captionsStayWithTheirImages:captionsPass,longStripRemainsWide:wide.strip.found&&wide.strip.wide&&wide.strip.width>300&&wide.strip.height>15,decorativeIconNotPromotedToArticleMedia:wide.iconCount===0,noHorizontalOverflow:wide.content.scrollWidth<=wide.content.width+1&&narrow.content.scrollWidth<=narrow.content.width+1};
  await page.unrouteAll();
  if(Object.values(assertions).some(value=>!value))throw Error(`Composite boundary fixture failed: ${JSON.stringify({assertions,sourceGeometry,wide,narrow})}`);
  return {status:response?.status(),sourceGeometry,wide,narrow,assertions,translation:"disabled; original view only"};
}
