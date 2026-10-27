async page => {
 // 1.0.6 site sweep: structures found on overreacted, Tailwind, Vue, jvns,
 // PEP 8 and GitHub issues. Own fixtures; no translation service is called.
 const worker=page.context().serviceWorkers()[0];
 await worker.evaluate(()=>chrome.storage.sync.set({readerView:'orig',autoTranslateEnabled:false}));
 const para=label=>`<p>${label} is a long paragraph of article prose that gives the reader enough context to keep this block.</p>`;
 const docs={
  'https://reader-fixture.example/docs':`<!doctype html><html><head><meta charset="utf-8"><title>Fixture docs</title></head><body><main><article>
   <h1>Fixture docs</h1>
   <h3>On this page</h3><ul><li><a href="#setup">Setup</a></li><li><a href="#usage">Usage</a></li><li><a href="#comments">Comments</a></li></ul>
   ${para('Introduction')}
   <h2 id="setup"><a href="#setup"><span aria-hidden="true">#</span>Setup</a></h2>
   ${para('Setup text')}
   <figure data-rehype-pretty-code-figure><figcaption>app.js</figcaption><pre><code>const figureCode = 1;</code></pre></figure>
   <figure class="wp-block-table"><table><thead><tr><th>Option</th><th>Default</th></tr></thead><tbody><tr><td>figureTableCell</td><td>on</td></tr></tbody></table><figcaption>Table caption kept</figcaption></figure>
   <h2 id="usage">Usage<a class="header-anchor" href="#usage">​</a></h2>
   <div class="options-api" style="display:none"><h3>Hidden alternative</h3>${para('Hidden tab')}</div>
   <div class="composition-api"><h3>Visible alternative</h3>${para('Visible tab')}</div>
   <ul><li>Wildcard imports should be avoided in this lead-in sentence:<p>Nested paragraph inside the item with its own explanation text.</p><pre><code>from x import *</code></pre></li></ul>
   <section id="comments"><h2>Comments</h2>${para('Comment chapter')}</section>
   <div id="comments-thread" class="comments">${para('Reader comment noise')}</div>
  </article></main></body></html>`,
  'https://github.com/fixture/repo/issues/1':`<!doctype html><html><head><meta charset="utf-8"><title>Fixture issue · Issue #1</title></head><body><main>
   <h1><bdi data-testid="issue-title">Fixture issue title</bdi></h1>
   <div data-testid="issue-body"><a data-testid="issue-body-header-author" href="/alice">alice</a><div class="markdown-body">${para('Opening post')}<pre><code>issueCode()</code></pre></div></div>
   <ol data-testid="issue-timeline-container">
    <li><div class="react-issue-comment"><a data-testid="avatar-link" href="/bob">bob</a><div class="markdown-body">${para('First reply')}</div></div></li>
    <li><div class="react-issue-comment"><a data-testid="avatar-link" href="/carol">carol</a><div class="markdown-body">${para('Second reply')}</div></div></li>
   </ol></main></body></html>`
 };
 await page.route('https://reader-fixture.example/**',route=>route.fulfill({contentType:'text/html',body:docs['https://reader-fixture.example/docs']}));
 await page.route('https://github.com/fixture/**',route=>route.fulfill({contentType:'text/html',body:docs['https://github.com/fixture/repo/issues/1']}));
 const open=async url=>{
  await page.goto(url);
  await worker.evaluate(async url=>{const t=(await chrome.tabs.query({})).find(t=>t.url===url);for(let i=0;i<15;i++){try{await chrome.tabs.sendMessage(t.id,{action:'TOGGLE_READER_MODE'});return;}catch(e){if(i===14)throw e;await new Promise(r=>setTimeout(r,200));}}},page.url());
  await page.waitForSelector('#reader-content');
  return page.evaluate(()=>{const root=document.querySelector('#raccoon-reader-root');const content=root.querySelector('#reader-content');return {text:content.textContent,codes:[...content.querySelectorAll('.reader-code-block')].map(n=>n.textContent.trim()),outline:[...root.querySelectorAll('.reader-outline-item')].map(n=>n.textContent.trim()),title:root.querySelector('.reader-title')?.textContent.trim(),authors:[...content.querySelectorAll('.reader-forum-author')].map(n=>n.textContent)};});
 };
 const docsResult=await open('https://reader-fixture.example/docs');
 const fail=message=>{throw Error(message+': '+JSON.stringify(docsResult).slice(0,1200));};
 if(!docsResult.codes.some(code=>code.includes('figureCode')))fail('code inside FIGURE dropped');
 if(!/figureTableCell/.test(docsResult.text)||!/Table caption kept/.test(docsResult.text))fail('table inside FIGURE dropped');
 if(docsResult.outline.some(item=>/^#|​|On this page/.test(item)))fail('permalink glyph or TOC heading in outline');
 if(!docsResult.outline.includes('Setup')||!docsResult.outline.includes('Usage'))fail('heading text lost with permalink');
 if(/On this page/.test(docsResult.text))fail('in-page table of contents kept');
 if(/Hidden tab|Hidden alternative/.test(docsResult.text)||!/Visible tab/.test(docsResult.text))fail('hidden tab panel handling');
 if(!/Wildcard imports should be avoided/.test(docsResult.text)||!/Nested paragraph inside the item/.test(docsResult.text))fail('list item lead text dropped');
 if(!/Comment chapter/.test(docsResult.text))fail('chapter section named comments dropped');
 if(/Reader comment noise/.test(docsResult.text))fail('comment thread container kept');
 const issue=await open('https://github.com/fixture/repo/issues/1');
 if(issue.title!=='Fixture issue title')throw Error('issue title: '+issue.title);
 if(!/Opening post/.test(issue.text)||!issue.codes.some(code=>code.includes('issueCode')))throw Error('issue body missing: '+issue.text.slice(0,300));
 if(issue.authors.join(',')!=='bob,carol'||!/First reply/.test(issue.text)||!/Second reply/.test(issue.text))throw Error('issue replies: '+JSON.stringify(issue.authors));
 await page.unrouteAll();
 return {passed:true,docsOutline:docsResult.outline,issueAuthors:issue.authors};
}
