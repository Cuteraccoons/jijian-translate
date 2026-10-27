# 工作交接 · 1.0.4 阅读模式

更新：2026-09-25。上轮产品修复提交 `84f7f4c`（其产品基线为 `f3bd6d7`）；本轮 W01 实现提交 `8945588`。后续提交号以 `git log -1` 为准。

## 先读这里

唯一源码是当前 `Jijian-Translate/` 仓库。外层 `archive/` 仅供追溯；`dist/` 由外层 `scripts/build-local.mjs` 生成。不要修改生成目录，也不要从历史文件夹恢复旧实现。

上一轮需求：修复大纲颜色按钮重叠；扩大百度百科结构调查；把后续需求拆清楚，方便换模型。**没有要求一次性完成所有百科适配。**

- [调查清单与 16 个可点击样本](docs/handoff/BAIKE-SURVEY.md)
- [后续任务、代码入口和验收条件](docs/handoff/BAIKE-TASKS.md)
- [检查方法与已完成验证](docs/handoff/VALIDATION.md)

- [逐步实施计划：每项操作与验收](docs/handoff/IMPLEMENTATION-PLAN.md)
- [维基百科 16 页模块调查](docs/handoff/WIKIPEDIA-SURVEY.md)

本轮追加：B03a 在可见浏览器复用苹果公司实页通过，六个表内图片均只输出一次。B02 已修复同名标题、包装层锚点和滚动条覆盖的行尾点击；fixture 与周杰伦实页通过，民法典实页先前也通过。苹果公司 B02 实测仍遇 HTTP 403，所以该项保留部分完成状态。周杰伦正文的图集与作品模块已改成横向卡组，实页重新开放后确认 13 张早年照片保留在轮播，现有 DOM 提供 10 张图片和 3 个空占位；代表作品、音乐专辑、影视作品等也按组呈现。自有宽窄屏 fixture 与新手指引回归通过。新增查词／翻译提速：合并重复请求、缓存 Google 快速释义、减少串行等待，并把 Google 页面翻译并发提升到最多 9 路。清华大学地图模块已实现轻量地点卡和详情链接，fixture 通过；阅读器实页复验遇 403。证据见 [验证记录](docs/handoff/VALIDATION.md)。当前未发布；只更新了本地生成版供回归使用。

本轮继续收敛周杰伦长条目：阅读模式入口不再等待整页滚动预热，图集和作品模块按阅读位置渐进唤醒；加载晚到的原图会回填轮播卡。6 行／超过 12000 字的单列大名单也保留为折叠表格；缩略占位图不再锁住百度百科正文里的原图尺寸。参考资料与表格、三张一组作品卡、顶部视频折叠／箭头和浏览器 Back 已有本地原文 fixture 回归。本机 `dist/Jijian-Translate` 已重新生成 1.0.4。周杰伦手动验证的源标签页本轮没有刷新；不要把 fixture 回归写成此次新版本的实页回归。

本轮完成 W03：为旧／新维基标题结构、重复标题、非 ASCII 锚点和长标题补了 fixture，并在 Germany、北京市、日本語、Berlin 四个实页运行新版阅读器。各页源标题、阅读器标题与目录数量及身份均一致，首中末锚点可定位，窄宽版无溢出。B02 苹果样本仍因 HTTP 403 未补验；不能将 W03 结果计为 B02 完成。

随后完成 W04：引用→条目→返回的映射在 Queen’s Pawn Game、Anthropology 两个实页通过；自有 fixture 另覆盖同一来源重复引用、多个回链、缺失目标和嵌套 navbox。模板 CSS 不再混入导航标题，navbox 默认收起以压住超长导航，姊妹项目入口保持展开。记录见 [验证记录](docs/handoff/VALIDATION.md)。

本轮继续修正百科媒体：顶部词条视频使用统一外框与高度，播放入口放在标题下，并可按组收起；音乐专辑封面和歌曲／创作歌曲记录都用完整四卡轮播，箭头整组翻页。8 张专辑图、6／7 行歌曲记录以及顶部视频收起／展开均通过本地浏览器 fixture。重载后百度词条新请求返回 403，所以等待页面可访问后再复验新版本实页；翻译服务未在本轮调用，查词提速的延迟数字来自模拟测试。详细边界见 [验证记录](docs/handoff/VALIDATION.md)。

本轮收尾修复并复验表格翻页／全部显示、长表按需展开、正文延迟图片和音乐合作人顿号断行。浏览器自动化现复用一个测试标签页；移除了回归脚本中的 `newPage()`，并清理 fixture 的网络路由，避免开很多标签或让 mock 串扰后续真实页面。W06 与 W07a/b/c 已完成对应 fixture 和公开实页结构检查。详细测试矩阵与限制见 [验证记录](docs/handoff/VALIDATION.md)。

用户确认周杰伦阅读页整体满意。新增中文首行缩进开关，以及高像素截图笔记的原图查看、单图保存、离线 HTML／JSON 导出；浏览器回归确认裁切保留 1280 × 170 px 源像素、设置开关正常，笔记可跨阅读模式重开。最新反馈要求把缩进入口移到“格式”并排除基本信息卡；同时收紧百科视频区、优化截图分享版式并识别列表式小标题。这些自有 fixture 回归已通过，仍只用一个标签页，苹果公司实页留给用户本人验证。

本轮追加：修复百度百科正文脚注与参考资料之间的跳转映射，点击上标会展开折叠的参考列表并定位到相应条目，回链返回正文；自有 fixture 与维基引用／棋盘交叉回归通过。没有触碰苹果公司用户页。B02 仍待苹果公司实页确认，按计划下一步继续使用现有测试标签页处理不依赖该手测样本的子任务。

## 1.0.5 交接（2026-10-07）

**源码位置已变更**：唯一源码现在是 `~/Developer/Jijian-Translate`（自带 Git 历史）。文稿里的 `极简翻译网页插件/Jijian-Translate` 仍是 1.0.4 原件，不再修改。迁移快照提交为 `0576778`，之后的提交都在新位置。浏览器应从新位置“加载已解压的扩展程序”。

### 本轮完成

- **设置页**：服务卡片使用官方标志（`icons/brands/`，来自 LobeHub Icons，MIT，见 `icons/brands/NOTICE.txt`）；译文样式分页且预览常驻；查词页图标为中性灰；侧栏分“翻译／词典与收藏／其他”三组；自动翻译新增“总是翻译的网站”（`autoTranslateDomainList` 之前没有界面）；去掉卡片阴影，只留悬停轻微上浮；关于页去掉宣传海报。收藏页保留 1.0.4 的时间／网站／排序筛选、笔记与截图笔记，另加语言标签、已掌握状态、原句、朗读和“在原文中查看”（Chrome 文字片段链接）。
- **Popup**：引擎与目标语言上移；译文样式折叠成一行摘要，右侧“展开／收起”标签；主按钮 70 px；“加入黑名单”保持原样。
- **双语**：`<br><br>` 分段和裸文字段落包成 `span.jijian-text-run`；隐藏元素与 1×1 读屏文字不再发送；视口内严格自上而下；只在识别出的正文区内翻译 div 正文。
- **阅读器**：设置面板由 4 个分页合并为“排版”“文章”两个（旧分区名仍在 DOM 中，`reader.css` 中每条按分页显示的规则旁都复制了一份 `data-merged-tool` 版本）；大纲选中色只显示色点；图片阴影／资料并排／杂志双栏改为开关列表；页面样式、表格样式改为紧凑文字按钮；“文章”页不再重复显示首行缩进。浮动按钮统一为主题卡片；大纲／设置收起键改为侧栏图标；收起设置后右上角为“Aa | ×”，可直接退出阅读模式。通用阅读路径会把分节文章扩大到父级。
- **欢迎页**：入场与翻页动画；磨砂翻页箭头，完成当前步后“下一步”变实心并有呼吸光圈；胶囊提示改为胶囊正上方的深色小气泡；沉浸阅读一步把演示页做成杂乱的复古老网站（横幅、计数器、施工条、广告），用来对比阅读模式的整洁。
- 生词收藏时记录所在原句（`context`）。

### 验证

- `node tests/release-audit.mjs`（12 项）与 `node tests/translation-core-audit.mjs` 通过。
- 新增 `tests/run-reader-live.mjs`：用本机缓存的 Playwright 无界面加载源码扩展，执行 `tests/reader-live/*.js`，不需要 Codex 的 playwright-cli 包装。例：`node tests/run-reader-live.mjs tests/reader-live/regression.js`。
- 18 个 reader-live fixture 中 17 个通过。`baike-video-carousel.js` 依赖封面加载时机，迁移基线上也时过时不过，属不稳定测试，未修。
- 因面板合并而更新的测试：`style-choice-layout.js`、`wiki-long-tables*.js`、`wiki-math*.js`、`chess-links-citations.js`、`reader104-regression.js`、`playwright-reader-regressions.js`、`playwright-runtime-audit.js`（分页名改为 `appearance`／`article`；大纲选中色断言改为色点；宣传图改为“已移除”）。`playwright-runtime-audit.js` 需要独立配置与本地服务，本轮**未运行**。
- 实站检查使用保存的静态页面（Paul Graham、Hacker News、Wikipedia、MDN、Python 文档、Dan Luu、overreacted）。双语只统计收集到的段落，引擎指向不可达地址，**未调用真实翻译服务**。百度百科实页仍由维护者本人验证。

### 下一步任务（按优先级）

1. **阅读面板继续打磨**：字体卡片仍偏高；“文章”页里导出、复制、截图笔记、下载与打印可再整合成更少的分组；文章信息统计的排版；左侧“大纲／媒体／搜索”分页样式与右侧统一。选中态目前是黑色描边，是否改为蓝色由维护者决定。
2. **网站适配**：请维护者提供读取不全或顺序异常的具体网址逐个处理。已知缺口：双语模式下带子列表的外层列表项自身文字被跳过（`collectTranslatableBlocks` 中 `LI` 含 `ul/ol` 时直接返回）。
3. **图片翻译**：建议“框选区域翻译”（`captureVisibleTab`，可覆盖背景图／canvas），AI 识图只做显式开启并提示上传；译文先列表展示再考虑回填。
4. **百度百科实页复验**（维护者手动）：周杰伦、苹果公司、民法典等。
5. 设置页与 Popup 深色模式；`floating.css` 中大量 `!important` 的整理。

## 1.0.6 阅读面板与组件化网页（2026-10-07 第二轮）

维护者反馈：纸张与大纲选中色的选中效果不一致；排版页下半部分（显示开关、页面／表格样式）太简陋；信息页的来源、复制、截图分享没有设计；笔记要独立分页，提示文案、框选边框和截图缩略图都要重做；设置分页与“阅读内容”分段控件长得一样，需要区分。**不要回退到 1.0.4 的样式，直接重新设计。**

- **右侧面板三分页**：排版／信息／笔记（`data-reader-tool-tab` 值仍为 `appearance`／`article`／`notes`，“信息”只是显示名）。分页改为带图标的下划线标签，左侧“大纲／媒体／搜索”同样式；分页内的选择（原文／双语／中文、横排／竖排、超链接样式）保留灰底分段控件，从而区分“导航”和“选项”。
- **重组方式**：`buildReaderToolPanes()`（`content.js`）在旧控件全部创建、事件绑定之后，把它们移入 `.rp-pane > .rp-group > .rp-field`，并去掉 `data-reader-tool-section`，旧的按分区显示规则因此不再生效；旧抽屉保留为隐藏的 `.rp-retired-drawer`。新样式集中在 `reader.css` 末尾“1.0.6 tool panel”段，选择器都以 `#reader-context-panel` 开头；`:is()` 里不要写 id（会把整条规则抬到 3 个 id，压过 `[hidden]` 等规则），用 `[id="…"]`。
- **统一选中态**：所有色块（纸张、大纲选中色、卡片底色）= 2.5 px 间隙 + 1.5 px 墨色描边；所有选项卡片（译文样式、字体、页面样式、表格样式）= 墨色边框。纸张和大纲选中色在标题右侧显示当前名称。
- **排版页**：分“内容／文字／页面／细节”四组；页面样式与表格样式改为新绘制的缩略图；图片阴影等开关为带图标和说明的列表。
- **信息页**：来源卡片（域名＋路径＋复制）、朗读／截图分享／回到顶部三格操作、阅读时长＋六项统计、显示开关、下载（2×2）与复制（原文／译文／双语）。
- **笔记页**（`reader-notes.js`）：黑色“截图笔记”主按钮；空状态三条用法说明；卡片为引用／想法／底栏图标操作，标签页显示笔记数量。截图缩略图至少按原屏幕尺寸的 50% 显示，宽或长的截图右侧／底部渐隐，点击查看完整截图（原先 1280 px 宽的截图被缩到约 230 px，文字糊成一片）。
- **框选**（`reader-share.js`）：胶囊工具条、底部深色提示、四角白色角标、选区下方尺寸标签；拖动时隐藏工具条。注意：角标伪元素不能加 `filter: drop-shadow`，Chrome 会把选框内部画成不透明。
- **组件化网页**（以 CFA Institute Financial Modeling 页为样本，原先只取到 Overview 的 3 段）：
  - `widenReaderContainer` 跳过不增加正文的包装层（最多 9 层），评论／相关／侧栏中的文字不计入；
  - `discoverReaderAccordions`：`aria-expanded` 触发器经 `aria-controls`／`href="#id"`／`data-bs-target` 或相邻面板找到折叠内容，渲染为阅读器自己的 `<details class="reader-accordion">`，内容递归收集（隐藏、`aria-hidden` 的面板也保留），展开状态跟随原页；连续 3 个以上加“全部展开／收起”。头部菜单（`aria-haspopup`、nav/header 内）不处理；
  - `discoverReaderCardGroups`：同一行并排、每张 6–520 字且有标题的小卡片保留为卡片网格，卡片标题不进大纲，独立的行动链接变成小圆角链接；
  - 修正：章节标题包含文章标题（“What is financial modeling?” vs “Financial Modeling”）不再被当成重复标题删掉，只有带分隔符的“标题 | 站点”才算重复。
  - 页面上的功能按钮（登录、切换、筛选）不进入阅读模式；内容里的链接照常保留。

### 1.0.6b 反馈调整（同日）

- 顶部“排版／信息／笔记”和左侧“大纲／媒体／搜索”改回灰底轨道＋白色滑块，但加了图标、更高的圆角与轻阴影；分页内部的选择（阅读内容、排版方向、超链接样式、字号）改为独立描边按钮，选中＝墨色边框，与选项卡片一致，因此和顶部导航区分开。
- 去掉分组之间与列表内的分割线（维护者不喜欢分割线），改用 26 px 分组留白；层级为分组标题（14 px 墨色）＞字段名（13 px 浅墨）＞数值（13 px 灰）。开关列表、统计、导出／复制按钮都是浅灰底独立块。排版页分组改名为“阅读／文字／版面／细节”，显示开关加了“显示效果”字段名。
- 文章信息：一行“预计阅读 N 分钟”＋六格统计。朗读播放器重排为一张卡：状态、进度、当前句（最多 3 行）、四个图标按钮、声音／语速、逐句／逐词；朗读中“朗读”格变为墨色。
- 所有开关统一一个样式，开启色跟随墨色，深色纸张下也看得见。
- Bug：内容脚本注入的 `fonts/smiley.css` 用相对地址，被网页按自身域名解析（GitHub 上报 404 和 CSP 错误）。改为内容脚本专用的 `fonts/smiley-content.css`，用 `chrome-extension://__MSG_@@extension_id__/` 地址；阅读器与 Popup 仍用原文件。来源卡片里的 `decodeURI` 遇到不规范编码会抛错，已兜底；`buildReaderToolPanes` 调用也包了 try/catch，避免布局异常中断阅读模式其余初始化。
- 维护者看到的报错只给出了 `#reader-speech-player` 这一行，无界面复现没有抛错，播放器能正常显示；若仍出现，请从扩展“错误”页复制完整报错文字。

### 1.0.6c 脚注与新手指引（同日）

- **脚注**：原文模式下维基百科、Paul Graham、Dan Luu 实页的脚注本来就能跳转；坏的是译文。`appendTranslatedCitations` 以前只认 `sup a`，并给所有链接加 `target="_blank"`，网页双语模式下点中文里的脚注会新开标签页。现在同页锚点不加 `_blank`，并识别 doc-noteref、`.footnote-ref`、`.footnote-anchor`、`rel=footnote`、`fnref*` 和指向本页锚点的 `[1]`／`1` 式链接；不带括号的数字只在紧跟句末标点时才当作脚注号。
- **阅读模式点页内链接会退出**：找不到映射目标时以前不拦截，浏览器跳锚点触发 `popstate`，阅读模式把它当作“返回”而关闭。现在所有同页锚点都拦截，先查映射，再查阅读器内同 id 元素。`wiki-references-navigation.js` 原先断言“坏链接不拦截”，已改为“拦截且阅读模式仍开着”。锚点映射另外收录正文前面的短锚点（Substack 的 `<a id="footnote-4">4</a><div><p>…`）。
- 新增 `tests/reader-live/footnotes-translated.js`：五种脚注写法，分别在网页双语翻译与阅读模式双语下验证（翻译为本地模拟）。
- **新手指引**：“更多功能”8 张卡片（宽屏 4 列，窄屏 2 列）；完成后 `body.guide-finished` 只显示居中的“准备好了，开始阅读吧！”和一行说明，隐藏卡片与“稍后再看”，回到上一步时恢复。
- `baike-body-media.js` 单独连续运行 7 次均通过，只在整套连续运行时偶发失败。

### 验证（本轮）

- `release-audit`（12 项）、`translation-core-audit`、`reader-notes-audit`、`reader-capture-audit` 通过。`baike-body-media.js` 偶发一次失败，单独重跑两次均通过。
- 新增 `tests/reader-live/accordion-cards.js`（自有 fixture：4 个单元折叠、3 种 FAQ 写法、三张卡片、头部菜单、含标题的章节名）通过。`style-choice-layout.js` 的色块高度下限改为 24 px；`chess-links-citations.js` 未改，通过。其余 fixture 通过；`baike-video-carousel.js` 在改动前基线上同样 3 次失败 2 次（封面加载时机），`reader104-regression.js` 在基线上也因启动页 sessionStorage 权限失败，均非本轮引入。
- CFA 实页（只读访问）：127 个块、10 个大纲标题、15 个折叠项（Unit 8 按链接锚点默认展开）、1 组卡片。另抽 20 个 `cases.json` 实页对比改动前后：18 页块数／字数／大纲完全一致；Nature 的“相关文章”与 BBC Travel 的文章预告变为卡片网格（大纲相应减少），属预期。
- 无界面浏览器里 `captureVisibleTab` 不能出图，截图笔记只验证了框选样式与笔记卡片（用预置数据），实际截图保存请维护者手动试一次。未调用真实翻译服务。

## 1.0.6 例行优化（2026-10-25，manifest 升至 1.0.6）

维护者要求：半个月未更新，做一轮整体优化（UI 协调、配置、潜在 bug、更多页面的解析）；**删除维基百科“杂志双栏”**（实际用不上且排得不好看）。没有指定具体任务。

### 改动

- **删除杂志双栏**：`readerWikipediaMagazine` 设置、开关、CSS 与测试断言全部移除；`translation-core-audit` 改为断言它不再出现。用户存储里残留的旧值无人读取，无害。“资料并排”保留，资料卡改为正文栏 ≥ 680 px（原 580 px）才靠右浮动。
- **设置页／Popup 深色模式**：`options.css`、`popup.css` 末尾各一段 `prefers-color-scheme: dark`。设置页主要靠改 token；Popup 旧规则大量 `!important`，深色段也用 `!important` 覆盖。译文样式预览刻意保持浅色网页。
- **阅读模式解析**（`content.js`，函数均在 `collectReaderContentNodes` 之前）：
  - `readerIsTransparentFigure`：只含 `pre`／`table`、不含图片视频的 `<figure>` 当作透明包装，内部代码与表格单独收集（之前整块丢失）。
  - `stripReaderPermalinks`：标题内只由 `#`／`¶`／`§`／零宽字符组成的同页锚点、`aria-hidden` 装饰被移除（大纲不再出现 “#TLDR”）。
  - `dropReaderTableOfContents`：删除“On this page／目录”等标题及其后同页锚点列表，以及成组的同页锚点列表项。
  - `readerIsChapterSection`：`<section id="comments"><h2>Comments</h2>` 这类以标题命名的文档章节不再被噪声正则删掉。
  - `readerListItemLeadParagraph`：作为包装层跳过的 `<li>`，其开头的裸文字单独成段保留。
  - 隐藏（`display:none`）的 `[role=tabpanel]`／`.tab-pane`／Vue `.options-api|.composition-api` 不再输出。
  - GitHub issue／PR／Discussions：与 Reddit 共用 `forumThread` 渲染，首帖为正文，其余评论进“讨论”。
- **网页双语**：`wrapOrphanTextRuns` 对 `LI`／`DD` 的最短文字段阈值从 20 降到 2，带子列表的短列表项文字也能翻译（交接里“已知缺口”）。
- **阅读面板**：“信息”页显示开关与首行缩进开关加图标与说明；标题信息栏“已读”前补间距。设置页“高亮底色”样式卡示例文字不再溢出预览框。

### 验证

- `release-audit`（12 项）、`translation-core-audit`、`reader-notes-audit`、`reader-capture-audit` 通过。
- `tests/reader-live/` 全部 23 个 fixture 通过（新增 `doc-structures.js`，覆盖上面各项与 GitHub issue 结构）。`baike-body-media.js` 在整套连跑时仍偶发超时一次，单独连跑 4 次均通过，与之前记录一致。
- `tests/run-reader-live.mjs` 新增 `CHROMIUM_PATH`：本机缓存的 Playwright 期望的 Chromium 版本未安装时，可指定 `~/Library/Caches/ms-playwright/chromium-*/…/Google Chrome for Testing`。
- 新增 `tests/reader-site-sweep.mjs` 与 `tests/reader-live/sweep-cases.json`（63 个可访问实站：新闻、博客、Substack、文档站、GitHub、arXiv HTML、中日文社区与百科）。只做结构检查，不调用翻译服务。本轮扫了约 100 个网址，约三分之一因 404／403／验证页记为 unavailable，已从用例中剔除。
- 实站前后对比：overreacted 代码块 0 → 61；GitHub issue 由只有最后一条评论变为正文＋27 条回复；PEP 8 缺失的 5 段全部找回；arXiv 论文表格 0 → 5；Vue 文档重复标题消失；Tailwind／jvns 页内目录不再重复。
- 未调用真实翻译服务；百度百科实页仍由维护者本人验证。截图只用于本轮自查，未做截图验收。

### 留给下一轮

- Tailwind 文档这类没有 `article`／`main` 的页面，正文容器落到 `body`，右侧栏的推广卡片（“From the creators of Tailwind CSS”）会混入正文末尾。
- AWS 文档的 “Note”／“Topics” 小标题进入大纲；Stripe 文档的选项卡内容只取到约一半；Apple 开发者文档的 Topics 符号列表未收录。

## 1.0.7 正体默认字体与 Safari 适配（2026-10-27 第二轮）

维护者反馈：默认译文是斜体的得意黑，不要斜体；已购买 Apple 开发者账号（审核中），先做 Safari 适配并让 Safari 版更全能。

- **字体**：`fontFamily` 默认 `system`；`translationFontDefaultV3` 迁移把仍是 `smiley-sans` 的用户一次性改回系统字体（得意黑只有 Oblique 字形）。设置页与 Popup 的选项标成“得意黑（斜体）”。
- **Safari**（细节见 `safari/README.md`）：
  - OCR：内联脚本移到 `ocr-sandbox.js`；用 `self.origin === 'null'` 判断是否在 Chrome 沙盒里，是则用 blob worker，否则用新文件 `ocr-worker.js`。Chrome 沙盒与“无沙盒”两种方式都实测识别出 HELLO / SECOND CARD。
  - 本地词典：无 `showOpenFilePicker`／`showDirectoryPicker` 时用 `<input type=file>`（文件夹用 `webkitdirectory`），把 File 存进原来的 IndexedDB 键；`getDictionaryFile`／`readFileHandleAsDataUrl` 接受 Blob。用假 MDX 验证了存储与读取链路；真词典解析未在 Safari 测。
  - 得意黑改由 `content.js` 里的 `FontFace` 注册，删除 `fonts/smiley-content.css`。
  - `tabSessionStorage()`：没有 `storage.session` 时用内存。
  - Popup：Safari 下注入失败时提示去扩展按钮里允许访问。
  - 触屏：`selectionchange` + 粗指针判断，选区稳定 450 ms 后在选区下方显示工具条（Chromium 移动端模拟验证）。
  - `scripts/build-safari.sh` 生成 `safari/Jijian Translate/` Xcode 工程（引用 `safari/web-extension/` 暂存文件，暂存时去掉 `sandbox` 与 `open_in_tab`）；macOS 与 iOS 模拟器目标都**编译成功**。
- **未验证**：没有在真正的 Safari 中运行（macOS 需要用户手动开启“允许未签名的扩展”；iOS 模拟器的设置界面渲染空白，未能启用扩展）。
- 打包：`scripts/package-chrome.sh` 生成 `dist/Jijian-Translate-<版本>.zip`，文件清单在 `scripts/release-files.sh`，Safari 暂存共用同一清单。版本升到 1.0.7（1.0.6 可能已上传）。

## 1.0.6 第二轮：翻译精度、轻量查词与 Safari 评估（2026-10-27）

维护者要求：评估 Safari 适配难度；提升翻译精度；查词更方便、轻巧；完成后打 ZIP 上传。

### 翻译（`background.js`）

- `buildTranslationSystemPrompt`：DeepSeek／OpenAI（未自定义提示词时）／Claude／Gemini／Ollama／自定义接口共用。用户改过 OpenAI 提示词则保留，只追加批量标记规则。
- 合批：只认 `⟦n⟧`；模型全部改写成 `[n]` 时，只接受行首的 `[n]`。修复了正文引用 `[1]` 把一段译文截断并错配到别段的问题。网页批次附带 `context: {title, host}`（`content.js` 发送）。
- `translateManyWithDeepL`：请求头 `DeepL-Auth-Key`，多段一次提交；`deeplTargetLang` 处理 ZH-HANS／ZH-HANT、EN-US、PT-BR。
- `splitForGoogle`：编码后超过 5000 字符的段落按句切成 ≤ 1600 字的块。没能验证 Google 是否接受 POST（本机当时被限流 429），所以仍用 GET。
- `cleanModelTranslation`：去掉“翻译：”前缀、代码围栏和原文没有的外层引号。
- 测试：`tests/translation-batch-audit.mjs`（模拟网络，11 项）。**没有调用真实翻译服务**，实际译文质量请维护者用自己的 Key 抽查。

### 查词（`content.js`、`floating.css`、`options.*`）

- `setupDictionaryCompactMode`：单词卡加 `dict-compact`；有简明释义且有次要分区时加 `dict-has-more`，次要分区隐藏，末尾“更多释义、例句与百科”按钮；状态存 `dictCardExpanded`。段落卡不受影响。
- 未配置 AI：不渲染输入框，页脚显示“配置 AI 后可问语境”，打开设置的 API 页。
- ⌥／Alt + 点击：`wordRangeAtPoint`（`caretPositionFromPoint` + `Intl.Segmenter`，并校验指针确实落在词上）；捕获阶段拦截 click，所以链接不打开、Mac 上也不触发 ⌥ 点击下载。已有选区时（⌥ 拖选）不触发，与“划选时需按住 ⌥”兼容。设置 `dictAltClickLookup`，默认开。
- 测试：`tests/reader-live/lookup-alt-click.js`（链接内单词、中文分词、普通点击仍可跳转）。

### Safari 评估（只评估，未改代码）

- 本机 Xcode 27 的 `xcrun safari-web-extension-converter` 能直接转换，生成 macOS／iOS 工程，macOS 版**无签名编译成功**。转换器只提示两项不支持：`sandbox`（OCR 沙盒页）和 `options_ui.open_in_tab`。
- 需要改的地方：
  1. **图片 OCR**：Safari 不支持 manifest `sandbox`，`ocr-sandbox.html` 依赖的 `unsafe-eval`／blob worker 策略会失效，需要改为普通扩展页内运行 Tesseract（`wasm-unsafe-eval` 已在 extension_pages 允许）并实测。
  2. **本地 MDX 词典**：Safari 没有 `showDirectoryPicker`／`showOpenFilePicker`，要改成 `<input type=file webkitdirectory>` 导入并把文件存进 IndexedDB，且无法像 Chrome 那样保持文件夹授权。
  3. **得意黑字体**：`fonts/smiley-content.css` 写死了 `chrome-extension://` 地址，Safari 的扩展协议不同，需改为脚本用 `runtime.getURL` 注入 `@font-face`；`popup.js` 里也有一处 `chrome-extension://` 判断需复查。
  4. **权限体验**：Safari 默认按网站逐个授权，自动翻译和悬浮入口要等用户在该站点允许后才出现，需要在欢迎页说明。
  5. iOS 上没有双击／⌥ 点击这类桌面手势，查词与阅读器需单独做触屏适配（可以后做，先只发 macOS）。
- 发布条件：需要 Apple Developer Program（年费 99 美元）签名、公证并通过 App Store 审核；没有账号只能在本机打开 Safari“允许未签名扩展”自用。
- 估计：macOS 版可用约 2–4 天（主要是 OCR 与本地词典两处）；加上 iOS 触屏适配与上架流程再多 1–2 周。

## 当前进度

已完成：维基百科延伸阅读与补充表格、组合棋盘、译文上标引用、表格原有彩色单元格、整行大纲点击、圆形纸张色块；百度百科摘要、基本信息、作品与图集的首轮提取。以上不等于全部网页适配完成。

上一轮已完成：删除大纲颜色按钮组残留的旧下拉框 CSS。旧 ID 规则的高优先级 `display:block` 覆盖新网格，造成按钮拥挤、重叠；现在统一两列网格及边界尺寸。12 种窗口／侧栏宽度／明暗主题组合通过布局断言，键盘选择也通过。

上一轮调查：16 个百度百科词条均能进入阅读模式，已采集章节未发现缺失，但层级、滚动定位、全部正文与媒体完整性仍需要专项检查。观察到 14 种 `data-module-type`。记录原网页结构，不复制全文，不截图。

仍待外部条件：苹果公司百度词条由用户手动验证；百度地图与顶部视频的新版阅读器实页输出仍待验证。周杰伦源页有 3 个早年照片空占位，DOM 没有图片 URL，阅读器不能恢复没有来源地址的图片。B06a 尚无确认的日期－事件时间线样本，B06b 因缺证据不实现；B04c 的综艺／演唱会语义仍待实际样本。W05 的北京定位图／标记组合已在宽窄屏比对通过；旗帜与定位图同组的真实组合边界仍待样本。不要把 fixture 结果写成这些实页已验收。

维基调查基线：16 页、四种语言，31 类选择器中 27 类有匹配（类别可重叠）。W01 已处理人口列表主表与伦敦气候折叠表，W02 已处理公式；嵌套媒体仍待 W06。章节齐全不代表内容完整。

## 更新计划

1. W01–W04、W06、W07a/b/c 已按各自边界验证；W05 的 fixture 与北京定位图／标记实页几何回归通过，旗帜／定位图同组仍待真实样本。W06 只验证媒体结构映射，不包含实际播放质量。
2. B02 苹果、B04 作品类型语义、B05/W05 组合图、B06a/b、B07 百度视频／地图实页仍按计划中的人工与样本依赖处理。
3. 本轮自动化回归共用一个 Playwright 标签页；继续使用 `wiki-single-reader`，不要创建新页／新标签，也不要碰百度人工验证页。
4. 每一步操作、依赖、验收和交付物，以 [详细实施计划](docs/handoff/IMPLEMENTATION-PLAN.md) 为准。保留 fixture 与实页结论的区别。
5. 当前保持 1.0.4 开发候选。本机加载目录已更新；不打 ZIP、不发布商店或创建正式 Release。
6. 按表继续的首项仍是 B03b 苹果公司单行图文表实页复验；此前页面遇 HTTP 403，不重试或绕过，等维护者提供可访问样本后再验。B02 苹果样本随后处理。

GitHub 最新公开 Release 最后确认为 1.0.2。商店最近确认公开版本为 1.0.1，维护者提交过 1.0.2；1.0.3 曾收到说明关键词拒审通知。后续审核结果未知，以后台为准。Git 提交、候选 ZIP 和商店发布是不同状态。

## 给接手模型的任务提示

> 阅读 AGENTS.md、HANDOFF.md、docs/handoff/IMPLEMENTATION-PLAN.md 以及对应站点调查。沿用用户已授权的计划逐项推进；复用一个浏览器窗口和一个标签页，不调用 `newPage()`，不触碰用户的百度人工验证页。先检查当前代码与已打开页面；真实页遇 403 就标 unavailable，不重试或绕过。用自有 fixture 补足测试，明确区分模拟与真实翻译。不要修改 `dist/` 源码，不要跳到不相邻任务。运行发布与翻译核心审计及对应原生扩展 DOM 回归，不做截图检查。结束时更新状态、证据与未解决项；不要把 fixture 结果记作实页验收。

## 产品约束

简体中文沟通，中英文间留空格。阅读界面小字至少 13 px；设置与 Popup 保留系统字体，不重新全局套用得意黑。正文按语种回退。保留简洁、黑白为主的控件设计。互动图鉴和相关星图可跳过；有意义的时间、作品、表格和正文不可因链接多而整块删除。无需截图验收，维护者做视觉抽查。
