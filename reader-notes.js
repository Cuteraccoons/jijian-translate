/* Article-local annotations. Text anchors survive reopening and preserve inline markup. */
(() => {
  if(globalThis.JijianReaderNotes)return;
  const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trash='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';
  const filePart=value=>String(value||'文章笔记').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim().slice(0,64)||'文章笔记';
  const download=(blob,name)=>{const objectUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=objectUrl;link.download=name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);};
  const request=message=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(message,response=>{const error=chrome.runtime.lastError;if(error||!response?.success)reject(new Error(error?.message||response?.error||'笔记操作失败'));else resolve(response);}));
  function attach(root,{title,url}){
    const panel=root.querySelector('#reader-notes-panel');if(!panel)return;
    const canonical=new URL(url);canonical.hash='';
    const key=`readerNotes:${canonical.href}`,blocks=()=>[...root.querySelectorAll('.reader-orig-p,.reader-trans-p')];
    let items=[],closed=false,writeQueue=Promise.resolve(),editor,imageViewer;
    const svg=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const icon={
      crop:svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
      mark:svg('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
      pen:svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
      locate:svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
      expand:svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
      save:svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
      page:svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'),
      data:svg('<path d="M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2"/>'),
      print:svg('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>')
    };
    panel.innerHTML=`<div class="reader-notes-heading"><div><b>本文笔记</b><span data-note-count>0</span></div><p class="reader-notes-status" role="status">只保存在这台设备上</p></div><button type="button" class="reader-notes-capture" data-note-capture>${icon.crop}<span><b>截图笔记</b><small>框选图表、公式或任意区域</small></span></button><div class="reader-notes-list"></div><div class="reader-notes-export"><span>导出笔记</span><div><button type="button" data-note-export="html">${icon.page}<span>离线网页</span></button><button type="button" data-note-export="json">${icon.data}<span>JSON 备份</span></button><button type="button" data-note-print="notes">${icon.print}<span>仅笔记 PDF</span></button><button type="button" data-note-print="article">${icon.print}<span>文章与旁注</span></button></div></div>`;
    const status=message=>{panel.querySelector('.reader-notes-status').textContent=message;};
    const persist=()=>{
      const snapshot=structuredClone(items);
      writeQueue=writeQueue.catch(()=>{}).then(async()=>{try{await request({action:'SAVE_READER_NOTES',items:snapshot,title});if(!closed)status('已保存 · 只保存在这台设备上');}catch(error){if(!closed)status('保存失败：'+error.message);throw error;}});
      return writeQueue;
    };
    const blockFor=anchor=>{
      const all=blocks(),candidate=all[anchor.block];
      if(candidate&&(!anchor.blockText||candidate.textContent===anchor.blockText||candidate.textContent.includes(anchor.quote)))return candidate;
      return all.find(node=>anchor.blockText&&node.textContent===anchor.blockText)||all.find(node=>anchor.quote&&node.textContent.includes(anchor.quote));
    };
    const rangeFor=(node,start,end)=>{
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let offset=0,first,last,current;
      while(current=walker.nextNode()){const len=current.length;if(!first&&start>=offset&&start<offset+len)first=[current,start-offset];if(end>offset&&end<=offset+len){last=[current,end-offset];break;}offset+=len;}
      if(!first||!last)return null;const range=document.createRange();range.setStart(...first);range.setEnd(...last);return range;
    };
    const clearMarks=id=>root.querySelectorAll(`[data-reader-note-id="${CSS.escape(id)}"]`).forEach(mark=>{if(mark.tagName==='MARK'){const parent=mark.parentNode;mark.replaceWith(...mark.childNodes);parent?.normalize();}else mark.remove();});
    const paint=item=>{
      clearMarks(item.id);
      (item.anchors||[]).forEach(anchor=>{
        const block=blockFor(anchor);if(!block)return;
        if(item.image)return;
        let start=anchor.start,end=anchor.end;
        if(block.textContent.slice(start,end)!==anchor.quote){start=block.textContent.indexOf(anchor.quote);end=start+anchor.quote.length;}
        if(start<0)return;const range=rangeFor(block,start,end);if(!range)return;
        const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);const nodes=[];let n;while(n=walker.nextNode())if(range.intersectsNode(n))nodes.push(n);
        nodes.reverse().forEach(node=>{let a=node===range.startContainer?range.startOffset:0,b=node===range.endContainer?range.endOffset:node.length;if(b<=a)return;const piece=document.createRange();piece.setStart(node,a);piece.setEnd(node,b);const mark=document.createElement('mark');mark.className='minimal-text-highlight reader-note-highlight';mark.dataset.highlightId=item.id;mark.dataset.readerNoteId=item.id;mark.title=item.note||'双击添加笔记';piece.surroundContents(mark);});
      });
    };
    const when=value=>{const date=new Date(value||'');return Number.isFinite(date.getTime())?`${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`:'';};
    const render=()=>{
      panel.querySelector('[data-note-count]').textContent=items.length;
      const badge=root.querySelector('[data-reader-notes-count]');if(badge){badge.textContent=items.length;badge.hidden=!items.length;}
      panel.classList.toggle('has-notes',items.length>0);
      const list=panel.querySelector('.reader-notes-list');list.replaceChildren();
      if(!items.length){
        const empty=document.createElement('div');empty.className='reader-notes-empty';
        empty.innerHTML=`<p>还没有笔记。读到想留下的地方，可以这样记：</p><ul><li><i>${icon.mark}</i><span><b>划线高亮</b>选中正文文字，在弹出的工具条里点“高亮”或“笔记”</span></li><li><i>${icon.crop}</i><span><b>截图摘录</b>点上方“截图笔记”，框选图表、表格或公式，按屏幕原始像素保存</span></li><li><i>${icon.pen}</i><span><b>补充想法</b>双击已高亮的文字，随时写下或修改想法</span></li></ul>`;
        list.append(empty);
      }
      items.forEach((item,index)=>{
        const card=document.createElement('article');card.className=`reader-note-card${item.image?' reader-note-card-image':''}`;
        const cssWidth=Math.round(item.region?.width||(item.imageWidth?item.imageWidth/(window.devicePixelRatio||1):0));
        const cssHeight=Math.round(item.region?.height||(item.imageHeight?item.imageHeight/(window.devicePixelRatio||1):0));
        const media=item.image
          ?`<button type="button" class="reader-note-image-frame" data-view-image aria-label="查看完整截图"${cssWidth?` style="--note-css-w:${cssWidth};--note-css-h:${cssHeight}"`:''}${cssWidth*.5>270?' data-wide':''}${cssHeight>440?' data-tall':''}><img src="${esc(item.image)}" alt="截图笔记" decoding="async"><span class="reader-note-image-hint">${icon.expand}${item.imageWidth&&item.imageHeight?`${item.imageWidth} × ${item.imageHeight} px`:'查看完整截图'}</span></button>`
          :`<button type="button" class="reader-note-quote" data-locate-quote title="回到原文">${esc(item.quote)}</button>`;
        const thought=item.note?`<p class="reader-note-text">${esc(item.note)}</p>`:`<button type="button" class="reader-note-add" data-edit-inline>${icon.pen}<span>写下想法…</span></button>`;
        const meta=[item.image?'截图':'',when(item.created)].filter(Boolean).join(' · ')||(item.image?'截图摘录':'文字高亮');
        card.innerHTML=`${media}${thought}<footer class="reader-note-foot"><span class="reader-note-meta">${esc(meta)}</span><div class="reader-note-actions"><button type="button" data-edit title="${item.note?'编辑想法':'添加想法'}" aria-label="${item.note?'编辑想法':'添加想法'}">${icon.pen}</button>${item.image?`<button type="button" data-save-image title="保存截图" aria-label="保存截图">${icon.save}</button>`:''}<button type="button" data-locate title="回到原文" aria-label="回到原文">${icon.locate}</button><button type="button" data-delete title="删除笔记" aria-label="删除笔记">${trash}</button></div></footer>`;
        card.querySelector('[data-delete]').addEventListener('click',()=>remove(item.id));
        card.querySelectorAll('[data-edit],[data-edit-inline]').forEach(button=>button.addEventListener('click',()=>edit(item)));
        const locate=()=>{const target=root.querySelector(`[data-reader-note-id="${CSS.escape(item.id)}"]`)||blockFor(item.anchors?.[0]||{});if(target){target.closest('details')?.setAttribute('open','');target.scrollIntoView({block:'center',behavior:'smooth'});}else status('原文已变化，未找到对应位置；笔记仍已保留。');};
        card.querySelectorAll('[data-locate],[data-locate-quote]').forEach(button=>button.addEventListener('click',locate));
        card.querySelector('[data-view-image]')?.addEventListener('click',()=>showImage(item));
        card.querySelector('[data-save-image]')?.addEventListener('click',()=>saveImage(item,index));
        list.append(card);
      });
    };
    const remove=async id=>{const previous=items;items=items.filter(item=>item.id!==id);try{await persist();clearMarks(id);render();}catch{items=previous;}};
    const closeEditor=()=>{editor?.remove();editor=null;};
    const edit=item=>{
      closeEditor();
      editor=document.createElement('div');editor.className='reader-note-editor';editor.setAttribute('role','dialog');editor.setAttribute('aria-label','编辑笔记');editor.innerHTML=`<div class="reader-note-editor-source">${item.image?`<img src="${esc(item.image)}" alt="截图笔记"><span>截图保持原始清晰度</span>`:`<blockquote>${esc(item.quote)}</blockquote>`}</div><label>笔记<textarea rows="5" maxlength="20000" placeholder="记下你的想法…">${esc(item.note)}</textarea></label><div><button type="button" data-cancel>取消</button><button type="button" data-save>保存笔记</button></div>`;root.append(editor);const anchor=root.querySelector(`[data-reader-note-id="${CSS.escape(item.id)}"]`)||blockFor(item.anchors?.[0]||{});const rect=anchor?.getBoundingClientRect();editor.style.setProperty('--note-left',`${Math.max(16,Math.min(rect?.left||innerWidth/2-180,innerWidth-376))}px`);editor.style.setProperty('--note-top',`${Math.max(16,Math.min(rect?.bottom+8||innerHeight/2-120,innerHeight-290))}px`);editor.querySelector('textarea').focus();
      editor.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeEditor();}if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();editor.querySelector('[data-save]').click();}});
      editor.querySelector('[data-cancel]').addEventListener('click',closeEditor);
      editor.querySelector('[data-save]').addEventListener('click',async()=>{const previous=item.note;item.note=editor.querySelector('textarea').value;try{await persist();paint(item);render();closeEditor();}catch{item.note=previous;if(editor)editor.querySelector('[data-save]').textContent='保存失败，重试';}});
    };
    const showImage=item=>{
      imageViewer?.remove();imageViewer=document.createElement('div');imageViewer.className='reader-note-image-viewer';imageViewer.setAttribute('role','dialog');imageViewer.setAttribute('aria-modal','true');imageViewer.setAttribute('aria-label','截图笔记原图');
      imageViewer.innerHTML='<button type="button" data-view-close aria-label="关闭原图" title="关闭原图"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><img alt="截图笔记原图"><p>按 Esc 或点击空白处关闭</p>';
      imageViewer.querySelector('img').src=item.image;root.append(imageViewer);
      const close=()=>{imageViewer?.remove();imageViewer=null;};const closeButton=imageViewer.querySelector('[data-view-close]');closeButton.addEventListener('click',close);imageViewer.addEventListener('click',event=>{if(event.target===imageViewer)close();});imageViewer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});closeButton.focus();
    };
    const saveImage=(item,index)=>{
      if(!item.image)return;const extension=item.image.startsWith('data:image/webp;')?'webp':'png';
      const comma=item.image.indexOf(','),binary=atob(item.image.slice(comma+1)),bytes=new Uint8Array(binary.length);for(let offset=0;offset<binary.length;offset++)bytes[offset]=binary.charCodeAt(offset);
      download(new Blob([bytes],{type:extension==='webp'?'image/webp':'image/png'}),`${filePart(title)}-截图笔记-${String(index+1).padStart(2,'0')}.${extension}`);status('截图已交给浏览器保存');
    };
    const addText=async(range,text,openEditor=false)=>{
      const anchors=[];blocks().forEach((block,index)=>{
        if(!range.intersectsNode(block))return;
        const partial=document.createRange();partial.selectNodeContents(block);
        if(block.contains(range.startContainer))partial.setStart(range.startContainer,range.startOffset);
        if(block.contains(range.endContainer))partial.setEnd(range.endContainer,range.endOffset);
        const quote=partial.toString();if(!quote.trim())return;
        const prefix=document.createRange();prefix.selectNodeContents(block);prefix.setEnd(partial.startContainer,partial.startOffset);
        const start=prefix.toString().length;anchors.push({block:index,blockText:block.textContent,quote,start,end:start+quote.length});
      });
      if(!anchors.length)return;
      const existing=items.find(item=>!item.image&&JSON.stringify(item.anchors)===JSON.stringify(anchors));if(existing){if(openEditor)edit(existing);return;}
      const item={id:crypto.randomUUID(),quote:text,anchors,note:'',created:new Date().toISOString()};items.push(item);
      try{await persist();paint(item);render();if(openEditor)edit(item);}catch{items=items.filter(other=>other!==item);}
    };
    panel.querySelector('[data-note-capture]').addEventListener('click',event=>{if(!event.isTrusted)return;root.readerCaptureNote?.(async({image,rect,pixels})=>{
      const all=blocks(),block=all.find(node=>{const r=node.getBoundingClientRect();return r.bottom>=rect.y&&r.top<=rect.y+rect.height&&r.right>=rect.x&&r.left<=rect.x+rect.width;});
      const br=block?.getBoundingClientRect();
      const item={id:crypto.randomUUID(),quote:'截图笔记',note:'',image,imageWidth:pixels?.width||0,imageHeight:pixels?.height||0,region:br?{x:rect.x-br.left,y:rect.y-br.top,width:rect.width,height:rect.height,sourceWidth:br.width}:null,anchors:block?[{block:all.indexOf(block),blockText:block.textContent}]:[],created:new Date().toISOString()};items.push(item);
      try{await persist();paint(item);render();setTimeout(()=>edit(item),0);}catch(error){items=items.filter(other=>other!==item);throw error;}
    });});
    const exportNotesHtml=()=>{
      if(!items.length){status('先添加一条高亮或笔记');return;}
      const noteHtml=(item,index)=>{
        const when=Number.isFinite(Date.parse(item.created||''))?new Date(item.created).toLocaleString('zh-CN'):'未记录时间';
        const source=item.image?`<figure><img src="${esc(item.image)}" alt="截图笔记">${item.imageWidth&&item.imageHeight?`<figcaption>原始截图 · ${item.imageWidth} × ${item.imageHeight} px</figcaption>`:''}</figure>`:`<blockquote>${esc(item.quote)}</blockquote>`;
        return `<article class="note"><header><span>${String(index+1).padStart(2,'0')} · ${item.image?'截图摘录':'文字高亮'}</span><time>${esc(when)}</time></header>${source}${item.note?`<p>${esc(item.note)}</p>`:''}</article>`;
      };
      const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 文章笔记</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f1ec;color:#252a30;font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.page{max-width:860px;margin:0 auto;padding:clamp(24px,6vw,64px) 20px}.masthead{padding:0 4px 24px;border-bottom:1px solid #dedbd4}.masthead h1{margin:0 0 8px;font-size:clamp(24px,4vw,34px);line-height:1.3;letter-spacing:-.025em}.masthead a{color:#69717a;font-size:13px;overflow-wrap:anywhere}.note{margin:22px 0;padding:20px;background:#fffefa;border:1px solid #e6e2d9;border-radius:14px;box-shadow:0 5px 22px #242a3009;break-inside:avoid}.note header{display:flex;justify-content:space-between;gap:14px;margin-bottom:14px;color:#737b83;font-size:13px}.note figure{margin:0;padding:7px;border:1px solid #ece8e0;border-radius:10px;background:#f7f5f0}.note img{display:block;width:100%;height:auto;max-height:1100px;object-fit:contain;border-radius:5px}.note figcaption{padding:7px 3px 1px;color:#878d94;font-size:12px}.note blockquote{margin:0;padding:4px 0 4px 16px;border-left:3px solid #d6bd82;color:#363c42}.note p{margin:15px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.source{margin:26px 4px 0;color:#858b92;font-size:12px;overflow-wrap:anywhere}@media print{body{background:#fff}.page{max-width:none;padding:0}.note{box-shadow:none}}</style></head><body><main class="page"><header class="masthead"><h1>${esc(title)} · 文章笔记</h1><a href="${esc(canonical.href)}">${esc(canonical.href)}</a></header>${items.map(noteHtml).join('')}<p class="source">由极简翻译导出 · ${esc(new Date().toLocaleString('zh-CN'))}</p></main></body></html>`;
      download(new Blob([html],{type:'text/html;charset=utf-8'}),`${filePart(title)}-文章笔记.html`);status('离线网页已导出，截图已嵌入文件。');
    };
    const exportNotesJson=()=>{
      if(!items.length){status('先添加一条高亮或笔记');return;}
      const backup={format:'jijian-reader-notes',version:1,title,sourceUrl:canonical.href,exportedAt:new Date().toISOString(),items};
      download(new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}),`${filePart(title)}-文章笔记备份.json`);status('JSON 备份已导出，包含截图原图与定位信息。');
    };
    panel.querySelector('[data-note-export="html"]').addEventListener('click',exportNotesHtml);
    panel.querySelector('[data-note-export="json"]').addEventListener('click',exportNotesJson);
    const printNotes=async mode=>{
      if(!items.length){status('先添加一条高亮或笔记');return;}
      const noteHtml=item=>`<aside class="note">${item.image?`<figure><img src="${esc(item.image)}" alt="截图笔记">${item.imageWidth&&item.imageHeight?`<figcaption>截图原始尺寸 ${item.imageWidth} × ${item.imageHeight} px</figcaption>`:''}</figure>`:`<blockquote>${esc(item.quote)}</blockquote>`}${item.note?`<p>${esc(item.note)}</p>`:''}</aside>`;
      let body='';
      if(mode==='notes')body=items.map(noteHtml).join('');
      else {
        const placed=new Set();
        const article=root.querySelector('#reader-content');
        body=[...article.children].map(original=>{const node=original.cloneNode(true);node.querySelectorAll('button,script,style,.reader-image-note-marker,.reader-capture-note-region').forEach(child=>child.remove());node.querySelectorAll('details').forEach(child=>child.open=true);if(node.tagName==='DETAILS')node.open=true;const notes=items.filter(item=>(item.anchors||[]).some(anchor=>{const block=blockFor(anchor);return block&&original.contains(block);}));notes.forEach(item=>placed.add(item.id));return `<section class="row"><div class="article">${node.outerHTML}</div><div>${notes.map(noteHtml).join('')}</div></section>`;}).join('');
        body+=items.filter(item=>!placed.has(item.id)).map(noteHtml).join('');
      }
      const iframe=document.createElement('iframe');iframe.className='reader-notes-print-frame';iframe.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;border:0';
      iframe.srcdoc=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)} · 笔记</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:14px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#20242a}h1{font-size:24px}a{color:inherit;word-break:break-all}img{display:block;max-width:100%;max-height:250mm;height:auto;object-fit:contain}figure{margin:0;padding:5px;border:1px solid #e6e2d9;border-radius:7px;background:#faf9f6}figcaption{margin-top:4px;color:#777;font-size:10px}p{white-space:pre-wrap}.row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:24px;border-top:1px solid #e4e5e7;padding:16px 0}.note{break-inside:avoid;margin:0 0 16px;padding:12px;border:1px solid #dedfe2;border-radius:8px}.note blockquote{margin:0 0 10px;padding-left:10px;border-left:3px solid #eed273}.article{min-width:0}.article table{max-width:100%;font-size:13px;border-collapse:collapse}.article td,.article th{border:1px solid #ddd;padding:4px}.article .reader-trans-p:not([data-loaded="true"]){display:none}mark{background:#f6df87;color:inherit}.reader-chart{display:none}.reader-table-heading{display:flex;gap:8px;align-items:center}button,svg{display:none}</style></head><body><h1>${esc(title)}</h1><p>${esc(canonical.href)}</p>${body}</body></html>`;
      iframe.onload=async()=>{await Promise.all([...iframe.contentDocument.images].map(img=>img.decode().catch(()=>{})));iframe.contentWindow.focus();iframe.contentWindow.print();};document.body.append(iframe);iframe.contentWindow?.addEventListener('afterprint',()=>iframe.remove(),{once:true});
      status('已打开打印窗口，可选择“另存为 PDF”');
    };
    panel.querySelectorAll('[data-note-print]').forEach(button=>button.addEventListener('click',()=>printNotes(button.dataset.notePrint)));
    const doubleClick=event=>{const mark=event.target.closest?.('[data-reader-note-id]');if(!mark)return;const item=items.find(item=>item.id===mark.dataset.readerNoteId);if(item){event.preventDefault();event.stopPropagation();edit(item);}};
    root.addEventListener('dblclick',doubleClick);
    root.readerNotes={addText,removeRange:range=>{const ids=new Set([...root.querySelectorAll('[data-reader-note-id]')].filter(mark=>range.intersectsNode(mark)).map(mark=>mark.dataset.readerNoteId));ids.forEach(remove);},print:printNotes};
    const translationObserver=new MutationObserver(()=>{items.filter(item=>!root.querySelector(`[data-reader-note-id="${CSS.escape(item.id)}"]`)).forEach(paint);});
    translationObserver.observe(root.querySelector('#reader-content'),{subtree:true,attributes:true,attributeFilter:['data-loaded']});
    root.cleanupReaderNotes=()=>{translationObserver.disconnect();closed=true;closeEditor();imageViewer?.remove();imageViewer=null;root.removeEventListener('dblclick',doubleClick);};
    (async()=>{try{const data=await request({action:'GET_READER_NOTES'});if(closed)return;items=Array.isArray(data.items)?data.items:[];
      if(data.items===null){const legacy=(data.legacy||[]).filter(item=>{try{const u=new URL(item.sourceUrl);u.hash='';return u.href===canonical.href;}catch{return false;}});legacy.forEach(item=>{const index=blocks().findIndex(node=>node.textContent.includes(item.orig));if(index>=0){const block=blocks()[index],start=block.textContent.indexOf(item.orig);items.push({id:item.id||crypto.randomUUID(),quote:item.orig,note:'',anchors:[{block:index,blockText:block.textContent,quote:item.orig,start,end:start+item.orig.length}]});}});}
      items.forEach(paint);render();
    }catch{status('笔记读取失败，请重新加载扩展后刷新页面。');}})();
  }
  globalThis.JijianReaderNotes={attach};
})();
