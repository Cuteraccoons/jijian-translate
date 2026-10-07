async page => {
  if(page.url()!=="https://en.wikipedia.org/wiki/Beijing")throw Error(`Expected the already-open Beijing test page, got ${page.url()}`);
  const inspect=()=>page.evaluate(()=>{
    const readerRoot=document.querySelector("#raccoon-reader-root");
    const sourceImages=[...document.querySelectorAll("img")].filter(image=>!image.closest("#raccoon-reader-root"));
    const sourceMap=sourceImages.find(image=>image.alt==="Beijing is located in China");
    const sourceMarker=sourceImages.find(image=>image.alt==="Beijing");
    const readerMap=readerRoot?.querySelector('.reader-composite img[alt="Beijing is located in China"]');
    const readerMarker=readerRoot?.querySelector('.reader-composite img[alt="Beijing"]');
    const common=(first,second,stop)=>{for(let node=first;node&&node!==stop;node=node.parentElement)if(node.contains(second))return node;return null;};
    const sourceGroup=common(sourceMap,sourceMarker,document.body);
    const readerGroup=common(readerMap,readerMarker,readerRoot);
    const geometry=(mapImage,markerImage)=>{
      if(!mapImage||!markerImage)return null;
      const mapBox=mapImage.getBoundingClientRect(),markerBox=markerImage.getBoundingClientRect();
      return {width:mapBox.width,height:mapBox.height,marker:{x:(markerBox.left-mapBox.left)/mapBox.width,y:(markerBox.top-mapBox.top)/mapBox.height,w:markerBox.width/mapBox.width,h:markerBox.height/mapBox.height}};
    };
    const source=geometry(sourceMap,sourceMarker),reader=geometry(readerMap,readerMarker);
    const content=readerRoot?.querySelector("#reader-content");
    return {sourceGroup:sourceGroup?`${sourceGroup.tagName.toLowerCase()}.${String(sourceGroup.className||"").split(/\s+/).slice(0,2).join(".")}`:"",readerGroup:readerGroup?`${readerGroup.tagName.toLowerCase()}.${String(readerGroup.className||"").split(/\s+/).slice(0,2).join(".")}`:"",source,reader,content:{width:content?.clientWidth||0,scrollWidth:content?.scrollWidth||0}};
  });
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForTimeout(900);
  const wide=await inspect();
  await page.setViewportSize({width:390,height:900});
  await page.waitForTimeout(900);
  const narrow=await inspect();
  const difference=(sample)=>sample.source&&sample.reader?Math.max(...["width","height"].map(key=>Math.abs(sample.source[key]-sample.reader[key])),...["x","y","w","h"].map(key=>Math.abs(sample.source.marker[key]-sample.reader.marker[key]))):Infinity;
  const wideDifference=difference(wide),narrowDifference=difference(narrow);
  if(wideDifference>.01||narrowDifference>.01||wide.content.scrollWidth>wide.content.width+1||narrow.content.scrollWidth>narrow.content.width+1)throw Error(`Beijing map composition changed: ${JSON.stringify({wide,narrow,wideDifference,narrowDifference})}`);
  return {url:page.url(),wide,narrow,wideDifference,narrowDifference,translation:"disabled; live structure and geometry only"};
}
