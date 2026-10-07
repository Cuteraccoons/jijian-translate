/* Local screenshot cards: browser capture, canvas composition and offline QR. */
(() => {
  if (globalThis.JijianReaderShare) return;
  const uiFont = '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Kaku Gothic ProN","Microsoft YaHei",sans-serif';
  const decodeImage = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  async function cropRegion(image, rect, viewport) {
    const shot=await decodeImage(image);
    const scaleX=shot.naturalWidth/viewport.width,scaleY=shot.naturalHeight/viewport.height;
    const left=Math.max(0,Math.floor(rect.x*scaleX)),top=Math.max(0,Math.floor(rect.y*scaleY));
    const right=Math.min(shot.naturalWidth,Math.ceil((rect.x+rect.width)*scaleX));
    const bottom=Math.min(shot.naturalHeight,Math.ceil((rect.y+rect.height)*scaleY));
    const width=right-left,height=bottom-top;
    if(width<1||height<1)throw new Error('截图区域为空，请重新框选');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(shot,left,top,width,height,0,0,width,height);
    let result=canvas.toDataURL('image/png');
    if(result.length>6_500_000)result=canvas.toDataURL('image/webp',.96);
    if(result.length>7_500_000)throw new Error('截图区域过大，请缩小选区后重试');
    return {image:result,width,height,scaleX,scaleY};
  }
  const capture = () => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({action:'CAPTURE_READER_SHARE'}, response => {
      const error = chrome.runtime.lastError;
      if (error || !response?.success) reject(new Error(error?.message || response?.error || '截图失败，请重试'));
      else resolve(response.image);
    });
  });
  async function compose({image, rect, viewport, title, url, color, showTitle=true, showLink=true, showQR=true, signature='', layout='card'}) {
    const shot=await decodeImage(image);
    const scaleX=shot.naturalWidth/viewport.width,scaleY=shot.naturalHeight/viewport.height;
    const sourceLeft=Math.max(0,Math.floor(rect.x*scaleX)),sourceTop=Math.max(0,Math.floor(rect.y*scaleY));
    const sourceRight=Math.min(shot.naturalWidth,Math.ceil((rect.x+rect.width)*scaleX));
    const sourceBottom=Math.min(shot.naturalHeight,Math.ceil((rect.y+rect.height)*scaleY));
    const photoWidth=(sourceRight-sourceLeft)/scaleX,photoHeight=(sourceBottom-sourceTop)/scaleY;
    const layouts={card:{padding:32,header:0,corner:14},editorial:{padding:36,header:showTitle?110:0,corner:2},compact:{padding:18,header:0,corner:7},film:{padding:30,header:28,corner:3},postcard:{padding:34,header:showTitle?74:32,corner:16}};
    const style=layouts[layout]||layouts.card;
    let width=Math.max(420,photoWidth+style.padding*2);const padding=style.padding,header=style.header;
    const dark=color==='#29313a';
    const qr=showQR ? qrcode(0,'M') : null;
    if(qr){qr.addData(new URL(url).href);qr.make();}
    const count=qr?.getModuleCount()||0, cell=Math.max(3,Math.ceil(120/(count+8))),qrSize=qr?(count+8)*cell:0;
    width=Math.max(width,qrSize+64+((showTitle||showLink||signature.trim())?200:0));
    const hasFooter=showTitle||showLink||showQR||signature.trim();
    const titleInHeader=showTitle&&(layout==='editorial'||layout==='postcard');
    const footer=hasFooter ? Math.max(showQR?qrSize+56:0,(showTitle&&!titleInHeader?66:0)+(signature.trim()?44:0)+(showLink?24:0)+40) : 0;
    const canvas=document.createElement('canvas');canvas.width=Math.round(width*scaleX);canvas.height=Math.round((photoHeight+padding*2+footer+header)*scaleY);
    const ctx=canvas.getContext('2d');ctx.setTransform(scaleX,0,0,scaleY,0,0);
    const gradients={dawn:['#f5ded8','#f8eee0','#e8e4f0'],sky:['#dce8f2','#eee8f4','#faf5ef'],sand:['#efe4d5','#f8f1e8','#e7e8dc']};
    const logicalHeight=canvas.height/scaleY;
    if(gradients[color]){const gradient=ctx.createLinearGradient(0,0,width,logicalHeight);gradients[color].forEach((c,i)=>gradient.addColorStop(i/2,c));ctx.fillStyle=gradient;}
    else ctx.fillStyle=color||'#f5f3ee';
    ctx.fillRect(0,0,width,logicalHeight);
    const x=(width-photoWidth)/2,photoY=padding+header;
    if(layout==='postcard'){
      ctx.fillStyle='#ffffff80';ctx.fillRect(0,0,width,6);
      ctx.fillStyle='#a86d4b';ctx.fillRect(0,0,Math.max(48,width*.16),6);
    }
    if(layout==='editorial'&&showTitle){
      ctx.fillStyle=dark?'#ffffff99':'#59625f';ctx.font=`600 11px ${uiFont}`;ctx.fillText('READING NOTES  /  阅读摘录',padding,padding+15);
      ctx.fillStyle=dark?'#fff':'#252a30';ctx.font=`650 22px ${uiFont}`;drawHeaderTitle(ctx,title,padding,padding+48,width-padding*2,dark);
      ctx.fillStyle=dark?'#ffffff50':'#29313a28';ctx.fillRect(padding,padding+85,width-padding*2,1);
    }
    if(layout==='postcard'){
      ctx.fillStyle=dark?'#fff':'#39434b';ctx.font=`600 11px ${uiFont}`;ctx.fillText('一页摘录',padding,padding+14);
      if(showTitle){ctx.fillStyle=dark?'#fff':'#252a30';ctx.font=`620 18px ${uiFont}`;drawHeaderTitle(ctx,title,padding,padding+42,width-padding*2,dark);}
    }
    if(layout==='film'){
      ctx.fillStyle=dark?'#ffffffa8':'#505861';ctx.font=`550 10px ${uiFont}`;ctx.fillText('MINIMAL READING  ·  SCREENSHOT',padding,padding+17);
    }
    if(layout==='card'||layout==='postcard'){
      ctx.save();ctx.shadowColor='rgba(35,41,45,.17)';ctx.shadowBlur=18;ctx.shadowOffsetY=7;
      ctx.fillStyle=dark?'#171a1e':'#fff';ctx.beginPath();ctx.roundRect(x-1,photoY-1,photoWidth+2,photoHeight+2,style.corner+1);ctx.fill();ctx.restore();
    }
    if(layout==='film'){
      ctx.fillStyle=dark?'#15181c':'#29313a';ctx.beginPath();ctx.roundRect(x-7,photoY-7,photoWidth+14,photoHeight+14,5);ctx.fill();
    }
    ctx.save();ctx.beginPath();ctx.roundRect(x,photoY,photoWidth,photoHeight,style.corner);ctx.clip();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(shot,sourceLeft,sourceTop,sourceRight-sourceLeft,sourceBottom-sourceTop,x,photoY,photoWidth,photoHeight);ctx.restore();
    if(layout==='editorial'||layout==='film'){
      ctx.strokeStyle=layout==='film'?'#ffffff45':'#ffffffaa';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,photoY,photoWidth,photoHeight,style.corner);ctx.stroke();
    }
    if(!hasFooter)return canvas;
    const footerTop=photoY+photoHeight+24;
    const qx=width-padding-qrSize,qy=footerTop+Math.max(0,(footer-qrSize-20)/2);
    if(qr){ctx.fillStyle='#fff';ctx.fillRect(qx,qy,qrSize,qrSize);ctx.fillStyle='#252a30';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect(qx+(c+4)*cell,qy+(r+4)*cell,cell,cell);}
    const maxWidth=width-padding*2-(qrSize?qrSize+22:0);
    const drawLines=(text,y,size,maxLines,availableWidth=maxWidth)=>{
      ctx.font=`${size===20?600:400} ${size}px ${uiFont}`;let line='',lines=[];
      for(const char of Array.from(text)){if(ctx.measureText(line+char).width>availableWidth&&line){lines.push(line);line=char;}else line+=char;}
      if(line)lines.push(line);
      if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(last.length&&ctx.measureText(last+'…').width>availableWidth)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
      lines.forEach((value,i)=>ctx.fillText(value,padding,y+i*(size+9)));return y+lines.length*(size+9);
    };
    ctx.fillStyle=dark?'#f2f3f4':'#272c33';let y=footerTop+25;
    if(showTitle&&!titleInHeader)y=drawLines(title,y,20,2)+8;
    ctx.fillStyle=dark?'#c4c8ce':'#626974';if(signature.trim())y=drawLines(signature.trim(),y,14,2)+6;
    if(showLink)drawLines(new URL(url).hostname,y,13,1);
    return canvas;
  }

  function drawHeaderTitle(ctx,title,x,y,width,dark){
    const text=String(title||'').trim();
    ctx.save();ctx.beginPath();ctx.rect(x,y-24,width,54);ctx.clip();ctx.fillStyle=dark?'#fff':'#252a30';
    let line='',lines=[];for(const character of Array.from(text)){if(ctx.measureText(line+character).width>width&&line){lines.push(line);line=character;}else line+=character;}if(line)lines.push(line);
    lines.slice(0,2).forEach((value,index)=>ctx.fillText(value,x,y+index*26));ctx.restore();
  }
  function attach(root, {title,url}) {
    const trigger=root.querySelector('#reader-share-screenshot');
    if(!trigger)return;
    let host, shadow, busy=false, artifact, objectUrl, originFocus, crop, noteCallback, updateQueued=false;
    const close = () => {
      host?.remove();host=null;shadow=null;artifact=null;
      if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;
      window.removeEventListener('keydown',keydown,true);
      window.removeEventListener('resize',resized);
      originFocus?.focus?.({preventScroll:true});
    };
    const keydown = event => {
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
      if(event.key==='Tab' && shadow){
        const buttons=[...shadow.querySelectorAll('button,input,select')].filter(button=>!button.disabled&&button.checkVisibility());
        if(!buttons.length)return;
        event.preventDefault();const index=buttons.indexOf(shadow.activeElement);
        buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
      }
    };
    const resized=()=>{if(host&&!busy)close();};
    const status = message => { const node=shadow?.querySelector('.status'); if(node)node.textContent=message; const hint=shadow?.querySelector('.hint'); if(hint)hint.textContent=message; };
    const preview = async () => {
      const color=shadow.querySelector('[data-color][aria-pressed="true"]')?.dataset.color || '#eee9df';
      const canvas=await compose({...artifact,title,url,color,
        showTitle:shadow.querySelector('[data-option="title"]').checked,
        showLink:shadow.querySelector('[data-option="link"]').checked,
        showQR:shadow.querySelector('[data-option="qr"]').checked,
        signature:shadow.querySelector('[data-signature]').value,layout:shadow.querySelector('[data-layout]').value});
      if(!host)return;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('图片生成失败');
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      objectUrl=URL.createObjectURL(blob);
      const img=shadow.querySelector('.preview img');img.src=objectUrl;
      shadow.querySelector('.preview').hidden=false;
      shadow.querySelector('.toolbar').hidden=true;
      shadow.querySelector('.hint').hidden=true;
      shadow.querySelector('.box').hidden=true;
      shadow.querySelector('.panel').focus();
      status(`原始像素 PNG · ${canvas.width} × ${canvas.height}`);
    };
    const updatePreview=async()=>{
      updateQueued=true;if(busy)return;busy=true;
      try{while(updateQueued&&host&&artifact){updateQueued=false;await preview();}}catch(error){status(error.message);}finally{busy=false;}
    };
    const take = async rect => {
      if(busy||!host)return;
      if(rect.width<80||rect.height<60){status('选区太小，请重新框选');shadow?.querySelector('.selection')?.classList.remove('dragging');const box=shadow?.querySelector('.box');if(box)box.hidden=true;const hint=shadow?.querySelector('.hint');if(hint)hint.textContent='选区太小，请拖出更大的区域 · Esc 取消';return;}
      busy=true;const currentHost=host;
      const viewport={width:innerWidth,height:innerHeight};
      try {
        currentHost.style.visibility='hidden';
        await frame();await frame();
        if(host!==currentHost)return;
        const image=await capture();
        if(host!==currentHost)return;
        if(innerWidth!==viewport.width||innerHeight!==viewport.height)throw new Error('窗口大小已变化，请重新截图');
        artifact={image,rect,viewport};
        if(noteCallback){
          const crop=await cropRegion(image,rect,viewport);
          await noteCallback({image:crop.image,rect,pixels:{width:crop.width,height:crop.height,scaleX:crop.scaleX,scaleY:crop.scaleY}});close();
        } else await preview();
      } catch(error){status(error.message || '生成失败，请重试');}
      finally {if(host===currentHost)host.style.visibility='visible';busy=false;}
    };
    const start=(callback=null)=>{
      if(busy)return;
      close();noteCallback=typeof callback==="function"?callback:null;originFocus=document.activeElement;
      host=document.createElement('div');host.id='raccoon-reader-share';
      host.style.cssText='all:initial;position:fixed;inset:0;z-index:2147483647;display:block';
      shadow=host.attachShadow({mode:'open'});
      const captureLabel=noteCallback?'截图笔记':'截图分享';
      const captureHint=noteCallback?'拖动框选区域，松开即保存为笔记 · 按屏幕原始像素 · Esc 取消':'拖动框选要分享的内容 · 仅截取当前可见页面 · Esc 取消';
      shadow.innerHTML=`<style>
        :host{font-family:${uiFont};color:#25312c}*{box-sizing:border-box;font-family:inherit}button{font:500 14px/1.3 ${uiFont};border:1px solid #d8ddd8;border-radius:9px;padding:10px 15px;background:#fff;color:#25312c;cursor:pointer}button:hover{background:#f3f5f2}button:focus-visible{outline:2px solid #64748b;outline-offset:3px}[hidden]{display:none!important}.selection{position:fixed;inset:0;cursor:crosshair;overflow:hidden;background:rgba(12,14,18,.3);transition:background-color .15s ease}.selection.dragging{background:transparent}.toolbar{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 32px);padding:6px 6px 6px 14px;background:rgba(255,255,255,.97);border:0;border-radius:999px;box-shadow:0 12px 40px rgba(10,12,16,.22),0 0 0 1px rgba(10,12,16,.06);display:flex;align-items:center;gap:10px;cursor:default;font:500 14px/1.3 ${uiFont};color:#1f2329}.toolbar .label{display:flex;align-items:center;gap:8px;white-space:nowrap}.toolbar .label svg{width:18px;height:18px;flex:none}.toolbar button{height:32px;padding:0 14px;border:0;border-radius:999px;background:#f0f1f3;color:#1f2329;font:500 13px/1 ${uiFont}}.toolbar button:hover{background:#e5e7ea}.toolbar button[data-close]{background:transparent;color:#5d646d}.toolbar button[data-close]:hover{background:#f0f1f3;color:#1f2329}.selection.dragging .toolbar,.selection.dragging .hint{opacity:0;pointer-events:none}.toolbar,.hint{transition:opacity .15s ease}.box{position:absolute;border:0;background:transparent;outline:0;box-shadow:0 0 0 1.5px #fff,0 0 0 2.5px rgba(0,0,0,.18),0 0 0 9999px rgba(12,14,18,.46);border-radius:3px;pointer-events:none}.box::before{content:\"\";position:absolute;inset:-4px;background-image:linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff);background-size:14px 3px,3px 14px,14px 3px,3px 14px,14px 3px,3px 14px,14px 3px,3px 14px;background-position:0 0,0 0,100% 0,100% 0,0 100%,0 100%,100% 100%,100% 100%;background-repeat:no-repeat}.box::after{content:attr(data-size);position:absolute;top:calc(100% + 9px);left:-2px;padding:5px 9px;border-radius:7px;background:rgba(20,22,26,.88);color:#fff;font:500 13px/1.2 ${uiFont};font-variant-numeric:tabular-nums;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.25)}.box:not([data-size])::after{display:none}.preview{position:fixed;inset:0;background:#20242b88;display:grid;place-items:center;padding:24px;cursor:default}.panel{width:min(960px,100%);max-height:94vh;overflow:auto;background:#fafbf9;border-radius:18px;padding:22px;outline:none}.heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;font-size:18px;font-weight:600}.heading button[data-close]{display:grid;place-items:center;width:40px;height:40px;padding:0;border-radius:50%;background:#fff;color:#333}.heading button[data-close] svg{width:18px;height:18px}.options{display:flex;gap:14px;flex-wrap:wrap;margin-top:16px;font-size:14px}.options label{display:flex;align-items:center;gap:6px}.options input[type=checkbox]{accent-color:#292e35;width:16px;height:16px}.options select{padding:8px;border:1px solid #ddd;border-radius:7px;background:white;color:#222;font-size:14px}.options input[type=text]{border:1px solid #d8ddd8;border-radius:7px;padding:9px;font-size:14px;min-width:180px}.preview img{display:block;max-width:100%;max-height:65vh;margin:auto;object-fit:contain;border-radius:10px}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin-top:18px}.actions .download{margin-left:auto;background:#292e35;color:white;border-color:#292e35}.actions [data-color]{width:32px;height:32px;padding:0;background:var(--swatch)}.actions [aria-pressed=true]{outline:2px solid #292e35;outline-offset:2px}.status{font-size:13px;line-height:1.5;color:#68766b;margin:14px 0 0}.hint{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 14px;background:rgba(20,22,26,.84);color:#fff;border-radius:999px;font:400 13px/1.3 ${uiFont};white-space:nowrap;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.2)}
      </style><div class="selection"><div class="box" hidden></div><div class="toolbar"><span class="label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>${captureLabel}</span><button data-visible>截取可见正文</button><button data-close>取消</button></div><div class="preview" hidden><div class="panel" role="dialog" aria-modal="true" aria-label="截图分享" tabindex="-1"><div class="heading"><span>截图分享</span><button data-close aria-label="关闭分享" title="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><img alt="截图分享卡预览"><div class="options"><label>版式<select data-layout><option value="card">留白卡片</option><option value="editorial">编辑页 · 顶部标题</option><option value="compact">紧凑分享</option><option value="film">胶片相框</option><option value="postcard">摘录明信片</option></select></label><label><input type="checkbox" data-option="title" checked>标题</label><label><input type="checkbox" data-option="link" checked>链接</label><label><input type="checkbox" data-option="qr" checked>二维码</label><label>署名<input type="text" data-signature maxlength="80" placeholder="你的名字或一句话"></label></div><div class="actions"><button data-color="#eee9df" style="--swatch:#eee9df" aria-label="暖纸背景" aria-pressed="true"></button><button data-color="#e3eee7" style="--swatch:#e3eee7" aria-label="浅绿背景" aria-pressed="false"></button><button data-color="#e5eaf2" style="--swatch:#e5eaf2" aria-label="雾蓝背景" aria-pressed="false"></button><button data-color="#f8f8f5" style="--swatch:#f8f8f5" aria-label="素白背景" aria-pressed="false"></button><button data-color="#29313a" style="--swatch:#29313a" aria-label="墨色背景" aria-pressed="false"></button><button data-color="dawn" style="--swatch:linear-gradient(135deg,#f5ded8,#f8eee0,#e8e4f0)" aria-label="晨光渐变" aria-pressed="false"></button><button data-color="sky" style="--swatch:linear-gradient(135deg,#dce8f2,#eee8f4,#faf5ef)" aria-label="云霞渐变" aria-pressed="false"></button><button data-color="sand" style="--swatch:linear-gradient(135deg,#efe4d5,#f8f1e8,#e7e8dc)" aria-label="沙丘渐变" aria-pressed="false"></button><button data-retry>重新截图</button><button class="download">保存图片</button></div><p class="status" aria-live="polite"></p></div></div><div class="hint">${captureHint}</div></div>`;
      document.documentElement.append(host);
      window.addEventListener('keydown',keydown,true);window.addEventListener('resize',resized);
      shadow.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',close));
      shadow.querySelector('[data-retry]').addEventListener('click',()=>start(noteCallback));
      shadow.querySelectorAll('[data-option],[data-signature],[data-layout]').forEach(input=>input.addEventListener('change',()=>{if(artifact)void updatePreview();}));
      shadow.querySelector('[data-visible]').addEventListener('click',event=>{
        if(!event.isTrusted)return;
        const card=root.querySelector('.reader-scroll-card').getBoundingClientRect();
        const area=root.querySelector('.reader-scroll-area').getBoundingClientRect();
        const x=Math.max(0,card.left,area.left),y=Math.max(0,card.top,area.top);
        take({x,y,width:Math.max(0,Math.min(innerWidth,card.right,area.right)-x),height:Math.max(0,Math.min(innerHeight,card.bottom,area.bottom)-y)});
      });
      shadow.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',async()=>{
        shadow.querySelectorAll('[data-color]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
        await updatePreview();
      }));
      shadow.querySelector('.download').addEventListener('click',()=>{
        if(!objectUrl)return;const link=document.createElement('a');link.href=objectUrl;link.download=`${title.replace(/[\\/:*?"<>|]/g,'-').slice(0,48)||'文章'}-分享.png`;link.click();status('图片已交给浏览器保存');
      });
      const selection=shadow.querySelector('.selection'),box=shadow.querySelector('.box');let startPoint;
      selection.addEventListener('wheel',event=>event.preventDefault(),{passive:false});
      selection.addEventListener('pointerdown',event=>{
        if(!event.isTrusted||busy||event.button!==0||event.target.closest('.toolbar,.preview'))return;
        startPoint={x:event.clientX,y:event.clientY};crop=null;delete box.dataset.size;selection.setPointerCapture(event.pointerId);box.hidden=false;selection.classList.add('dragging');
        Object.assign(box.style,{left:`${startPoint.x}px`,top:`${startPoint.y}px`,width:'0px',height:'0px'});
      });
      selection.addEventListener('pointermove',event=>{
        if(!startPoint)return;
        const x=Math.max(0,Math.min(innerWidth,event.clientX)),y=Math.max(0,Math.min(innerHeight,event.clientY));
        crop={x:Math.min(x,startPoint.x),y:Math.min(y,startPoint.y),width:Math.abs(x-startPoint.x),height:Math.abs(y-startPoint.y)};
        Object.assign(box.style,{left:`${crop.x}px`,top:`${crop.y}px`,width:`${crop.width}px`,height:`${crop.height}px`});box.dataset.size=`${Math.round(crop.width)} × ${Math.round(crop.height)}`;
      });
      selection.addEventListener('pointerup',()=>{if(!startPoint)return;startPoint=null;if(crop)take(crop);});
      selection.addEventListener('pointercancel',()=>{startPoint=null;box.hidden=true;selection.classList.remove('dragging');});
      shadow.querySelector('[data-visible]').focus();
    };
    trigger.addEventListener('click',event=>{if(event.isTrusted)start();});
    root.readerCaptureNote=callback=>start(callback);
    root.cleanupReaderShare=close;
  }
  globalThis.JijianReaderShare={attach,compose,cropRegion};
})();
