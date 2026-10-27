// Reader-mode sweep over real websites (structure only, no translation calls).
//   CHROMIUM_PATH=/path/to/chrome node tests/reader-site-sweep.mjs tests/reader-live/sweep-cases.json out.jsonl [extDir] [concurrency]
// Each line of out.jsonl records source vs reader text coverage, outline,
// block types, short noise blocks, duplicates and overflow for one page.
// "unavailable" = HTTP error or bot wall; it is not counted as a reader result.
import { createRequire } from 'module'; import fs from 'fs'; import os from 'os'; import path from 'path';
const require=createRequire(import.meta.url);
const [,,casesFile,outFile,ext=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),conc='3']=process.argv;
const npx=path.join(os.homedir(),'.npm/_npx');
const userDir=fs.mkdtempSync(path.join(os.tmpdir(),'jj-scan-'));let context;
for(const d of fs.readdirSync(npx)){const c=path.join(npx,d,'node_modules/playwright');if(!fs.existsSync(c+'/package.json'))continue;try{context=await require(c).chromium.launchPersistentContext(userDir,{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{channel:'chromium'}),args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1440,height:1000},locale:'en-US'});break;}catch{}}
if(!context)throw Error('no playwright');
const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
await worker.evaluate(()=>chrome.storage.sync.set({autoTranslateEnabled:false,readerView:'orig',readerTheme:'white',readerOutlineCollapsed:false,readerToolsCollapsed:false,readerSurface:'card',onboardingDone:true}));
const cases=JSON.parse(fs.readFileSync(casesFile,'utf8'));
fs.writeFileSync(outFile,'');
const JUNK=/^(share|subscribe|sign (up|in)|log ?in|advertisement|related( articles| stories)?|read more|more from|newsletter|cookie|accept|follow|comments?|leave a comment|you might also like|recommended|sponsored|skip to|copy link|print|email|tweet|分享|订阅|登录|注册|广告|相关(推荐|文章|阅读)|阅读更多|猜你喜欢|热门|评论|点赞|收藏|关注|推荐阅读|上一篇|下一篇|返回顶部|举报)\b/i;
async function run(item){
 const page=await context.newPage();const r={id:item.id,url:item.url,errors:[]};const t0=Date.now();
 page.on('pageerror',e=>{if(/raccoon|reader|jijian|content\.js/i.test(e.stack||''))r.errors.push(String(e.message).slice(0,200));});
 page.on('console',m=>{if(m.type()==='error'&&/chrome-extension|raccoon|reader/i.test(m.text()))r.errors.push('console:'+m.text().slice(0,200));});
 try{
  try{const resp=await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:30000});r.http=resp?.status();}catch(e){r.nav=e.message.split('\n')[0];}
  await page.waitForTimeout(2500);
  r.before=await page.evaluate(()=>{
   const text=document.body?.innerText||'';
   const cands=[...document.querySelectorAll('article,main,[role=main],.post-content,.entry-content,.article-content,#content')];
   const root=cands.sort((a,b)=>b.innerText.length-a.innerText.length)[0]||document.body;
   const vis=el=>!el.closest('nav,header,footer,aside,[aria-hidden="true"],form')&&el.getBoundingClientRect().height>0;
   const paras=[...root.querySelectorAll('p,li,blockquote,pre')].filter(vis).map(x=>x.innerText.trim()).filter(x=>x.length>=80);
   const n=Math.min(24,paras.length);
   const samples=Array.from({length:n},(_,i)=>paras[Math.floor(i*(paras.length-1)/Math.max(1,n-1))]).map(x=>x.slice(0,120));
   const heads=[...root.querySelectorAll('h1,h2,h3')].filter(vis).map(h=>h.innerText.trim()).filter(Boolean);
   return {title:document.title.slice(0,100),chars:text.length,rootTag:root.tagName+(root.id?'#'+root.id:'')+(root.className&&typeof root.className==='string'?'.'+root.className.split(/\s+/)[0]:''),rootChars:root.innerText.length,paras:paras.length,heads:heads.slice(0,40),imgs:[...root.querySelectorAll('img')].filter(i=>vis(i)&&i.getBoundingClientRect().width>80).length,tables:root.querySelectorAll('table').length,pre:root.querySelectorAll('pre').length,samples,
    blocked:/^(Access Denied|Just a moment|Attention Required|Checking|403|Robot|Are you a robot|安全验证)/i.test(document.title)||text.length<200||(/verify you are human|unusual traffic|captcha|enable javascript and cookies/i.test(text)&&text.length<4000)};
  });
  if(r.before.blocked||r.http>=400){r.status='unavailable';return r;}
  const url=page.url();
  await worker.evaluate(async url=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url===url);if(!tab)throw Error('tab?');for(let i=0;i<12;i++){try{await Promise.race([chrome.tabs.sendMessage(tab.id,{action:'TOGGLE_READER_MODE'}),new Promise((_,j)=>setTimeout(()=>j(Error('timeout')),15000))]);return;}catch(e){if(i===11)throw e;await new Promise(r=>setTimeout(r,500));}}},url);
  await page.waitForSelector('#raccoon-reader-root #reader-content',{timeout:20000});
  await page.waitForTimeout(2500);
  r.after=await page.evaluate(([samples,JUNKsrc])=>{
   const JUNK=new RegExp(JUNKsrc,'i');
   const root=document.querySelector('#raccoon-reader-root'),content=root.querySelector('#reader-content');
   const norm=t=>t.normalize('NFKC').replace(/\[\d+\]/g,'').replace(/\s+/g,'').toLowerCase();
   const text=content.textContent,N=norm(text);
   const matched=samples.filter(x=>N.includes(norm(x)));
   const blocks=[...content.children];
   const types={};blocks.forEach(b=>{const k=b.className.split(/\s+/).filter(c=>c.startsWith('reader-'))[0]||b.tagName;types[k]=(types[k]||0)+1;});
   const shortBlocks=blocks.map(b=>b.innerText.trim()).filter(t=>t&&t.length<40);
   const junk=shortBlocks.filter(t=>JUNK.test(t)).slice(0,12);
   const dupMap={};blocks.forEach(b=>{const t=b.innerText.trim();if(t.length>30)dupMap[t]=(dupMap[t]||0)+1;});
   const dups=Object.entries(dupMap).filter(([,c])=>c>1).map(([t,c])=>c+'x '+t.slice(0,60)).slice(0,6);
   const outline=[...root.querySelectorAll('.reader-outline-item')].map(x=>x.textContent.trim());
   const scroll=root.querySelector('#reader-scroll-area');
   const imgs=[...content.querySelectorAll('img')];
   const brokenImgs=imgs.filter(i=>i.complete&&i.naturalWidth===0).length;
   const tinyImgs=imgs.filter(i=>{const b=i.getBoundingClientRect();return b.width>0&&b.width<24&&b.height<24;}).length;
   const wideEls=[...content.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>content.getBoundingClientRect().right+12&&!e.closest('pre,table,.reader-table-scroll,.reader-code-block,[style*="overflow"]')).slice(0,5).map(e=>e.tagName+'.'+(e.className+'').slice(0,40));
   const emptyBlocks=blocks.filter(b=>!b.innerText.trim()&&!b.querySelector('img,video,iframe,svg,canvas,math,table')).length;
   return {title:root.querySelector('.reader-title')?.textContent?.trim().slice(0,100),meta:root.querySelector('.reader-meta,.reader-byline')?.textContent?.trim().slice(0,120),chars:text.length,blocks:blocks.length,types,outline:outline.slice(0,40),outlineN:outline.length,imgs:imgs.length,brokenImgs,tinyImgs,tables:content.querySelectorAll('table').length,pre:content.querySelectorAll('pre').length,samples:samples.length,matched:matched.length,missing:samples.filter(x=>!N.includes(norm(x))).slice(0,6),junk,dups,overflow:scroll.scrollWidth-scroll.clientWidth,wideEls,emptyBlocks,empty:root.querySelector('.reader-empty')?.textContent||'',first:blocks.slice(0,4).map(b=>b.innerText.trim().slice(0,90)),last:blocks.slice(-4).map(b=>b.innerText.trim().slice(0,90))};
  },[r.before.samples,JUNK.source]);
  r.status=r.after.chars<300?'failed':(r.after.matched<Math.ceil(r.after.samples*.75)||r.after.junk.length>2||r.after.overflow>8||r.after.dups.length)?'inspect':'ok';
  delete r.before.samples;
 }catch(e){r.status='error';r.err=e.message.split('\n')[0];}
 finally{r.ms=Date.now()-t0;await page.close().catch(()=>{});fs.appendFileSync(outFile,JSON.stringify(r)+'\n');console.log(r.id,r.status,r.ms);}
}
const queue=[...cases];
await Promise.all(Array.from({length:+conc},async()=>{while(queue.length)await run(queue.shift());}));
await context.close();fs.rmSync(userDir,{recursive:true,force:true});
