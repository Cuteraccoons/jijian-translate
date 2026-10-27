// Translation batch pipeline with a mocked network (no real API calls):
// segment markers vs citations, Claude output budget, DeepL multi-text and
// language codes, long-paragraph splitting for Google, model-output cleanup.
//   node tests/translation-batch-audit.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const src=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','background.js'),'utf8');
const store={translationEngine:'deepseek',deepseekApiKey:'k',deeplAuthKey:'d',claudeApiKey:'c'};
const ev=()=>({addListener(){}});
const area=()=>({get:(k,cb)=>{const r={...store};cb?cb(r):0;return Promise.resolve(r);},set:(o,cb)=>{Object.assign(store,o);cb&&cb();return Promise.resolve();},remove:()=>Promise.resolve()});
const calls=[];let responder=null;
const ctx={console,setTimeout,clearTimeout,URL,URLSearchParams,AbortController,TextEncoder,TextDecoder,encodeURIComponent,decodeURIComponent,
 importScripts(){},self:{},indexedDB:undefined,
 chrome:{runtime:{getManifest:()=>({version:'1.0.6'}),onInstalled:ev(),onMessage:ev(),onStartup:ev(),getURL:x=>x,id:'x'},storage:{sync:area(),local:area(),session:area(),onChanged:ev()},contextMenus:{removeAll:cb=>cb&&cb(),create(){},onClicked:ev()},commands:{onCommand:ev()},tabs:{onRemoved:ev(),onUpdated:ev(),onActivated:ev()},action:{setBadgeText(){},setBadgeBackgroundColor(){}}},
 fetch:async(url,opts={})=>{calls.push({url:String(url),opts});return responder(String(url),opts);}};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(src+'\n;globalThis.__t={translateBatchWithIds,splitForGoogle,deeplTargetLang,cleanModelTranslation,buildTranslationSystemPrompt};',ctx);
const t=ctx.__t;const ok=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1;}else console.log('ok',m);};
// 1. citation inside paragraph must not split segments
responder=async(url,opts)=>{const body=JSON.parse(opts.body);const user=body.messages[1].content;ok(body.messages[0].content.includes('⟦0⟧')&&body.messages[0].content.includes('Coffee'),'batch prompt has marker rule and context');
 return {ok:true,json:async()=>({choices:[{message:{content:'⟦0⟧ 咖啡是一种饮料[1]，广受欢迎[2]。\n\n⟦1⟧ 第二段[3]。'}}]})};};
let r=await t.translateBatchWithIds([{id:'a',text:'Coffee is a drink[1], widely loved[2].'},{id:'b',text:'Second paragraph[3].'}],'auto','zh-CN',null,{title:'Coffee - Wikipedia',host:'en.wikipedia.org'});
ok(r[0].text.includes('广受欢迎')&&r[1].text.startsWith('第二段'),'citations stay in paragraph: '+JSON.stringify(r.map(x=>x.text)));
// 2. loose markers at line starts
store.translationEngine='claude';
responder=async(url,opts)=>{const b=JSON.parse(opts.body);ok(b.max_tokens>1024||b.messages[0].content.length<500,'claude max_tokens '+b.max_tokens);return {ok:true,json:async()=>({content:[{text:'[0] 甲段[9]内容\n[1] 乙段'}]})};};
r=await t.translateBatchWithIds([{id:'a',text:'Alpha one '+'x'.repeat(900)},{id:'b',text:'Beta two'}],'auto','zh-CN');
ok(r[0].text.includes('甲段[9]内容')&&r[1].text==='乙段','loose markers at line start: '+JSON.stringify(r.map(x=>x.text)));
// 3. DeepL multi-text with header auth & codes
store.translationEngine='deepl';
responder=async(url,opts)=>{const p=new URLSearchParams(opts.body);ok(opts.headers.Authorization==='DeepL-Auth-Key d'&&!p.has('auth_key'),'deepl header auth');ok(p.getAll('text').length===2&&p.get('target_lang')==='ZH-HANT','deepl multi text + ZH-HANT');return {ok:true,json:async()=>({translations:[{text:'一',detected_source_language:'EN'},{text:'二',detected_source_language:'EN'}]})};};
r=await t.translateBatchWithIds([{id:'a',text:'one'},{id:'b',text:'two'}],'auto','zh-TW');
ok(r.map(x=>x.text).join()==='一,二','deepl results in order');
ok(t.deeplTargetLang('en')==='EN-US'&&t.deeplTargetLang('pt')==='PT-BR'&&t.deeplTargetLang('ja')==='JA','deepl codes');
// 4. Google split
const long=('The quick brown fox jumps over the lazy dog. ').repeat(150);
const chunks=t.splitForGoogle(long);ok(chunks.length>1&&chunks.join('')===long&&chunks.every(c=>c.length<=1600),'google split '+chunks.length);
ok(t.splitForGoogle('short').length===1,'google short unsplit');
// 5. cleanup
ok(t.cleanModelTranslation('翻译：你好')==='你好'&&t.cleanModelTranslation('“你好”','hello')==='你好'&&t.cleanModelTranslation('“你好”','"hello"')==='“你好”','clean model output');
