# 验证与复现

## 本轮完成的验证

- 原生扩展加载源码，实际打开 16 个百度百科页面；结构结果保存于同目录 JSON。
- `style-choice-layout.js`：1440/800 px 窗口 × 260/320/420 px 侧栏 × 白／黑主题，共 12 组。验证两列网格、按钮不相交、不溢出、标签容纳、至少 38 px 高；键盘聚焦绿色选项并按 Enter 验证 aria-pressed。
- 无截图，无真实或模拟翻译调用。采集成功不代表视觉审核通过，也不代表视频可播放。

本轮发布审计、翻译核心审计及 `git diff --check` 均通过。1.0.4 候选包已重新生成，并核对根目录版本与 reader.css 一致。

## 必跑静态审计

在源码根目录运行：

```sh
node tests/release-audit.mjs
node tests/translation-core-audit.mjs
git diff --check
```

## 原生浏览器采集

使用已安装 Playwright CLI 的 Chromium，启动参数必须加载源码扩展：`--load-extension=<源码绝对路径>`、`--disable-extensions-except=<源码绝对路径>`，并移除默认的 `--disable-extensions`。浏览器可执行文件依本机实际安装位置选择，不硬编码旧缓存版本。修改 content.js 后重启浏览器，避免检查旧内容脚本。

本轮会话名 `releasefix`，临时启动配置 `/tmp/jijian103-native.json`（名称旧，但加载当前源码）。临时配置可能被清理，不作为仓库依赖。若会话不存在，先按上述参数新建持久会话。

```sh
python3 tests/reader-live/run-baike-inventory.py --session releasefix --output docs/handoff/baike-inventory-new.json
```

脚本默认调用 `~/.codex/skills/playwright/scripts/playwright_cli.sh`。其他机器应替换 wrapper 路径。每页单独写入，失败记录 error，不把失败记成兼容成功。重跑用新输出文件，不覆盖历史证据。

`style-choice-layout.js` 是 CLI run-code 的函数模板，直接把全文作为一个参数传入，不能当 Node 程序执行。可使用 Python 的 subprocess 参数数组读取传递，避免 shell 转义问题。

现有 `chess-links-citations.js` 的引用翻译部分模拟服务响应，只验证界面与引用结构，不代表真实服务质量。本轮百科采集不调用该模拟。

## 统计口径

源数据先采集，进入阅读器会触发有限懒加载预热。两者媒体总数不可直接计算保留率。正文图片过滤 button 后代和 chrome-extension 资源；总 IMG 包含每段翻译图标，不能拿来报重复插图。表格包含布局表、嵌套表，需按语义核对。标题匹配不替代滚动位置验收。

## 打包

外层运行 `node scripts/build-local.mjs` 生成本地加载目录，再从生成目录压 ZIP，确保 manifest.json 在 ZIP 根目录。保持 1.0.4 候选；文档与测试不进入扩展包。商店提交与正式 Release 由维护者决定。

## 维基百科调查（2026-09-24）

原生扩展调查 16 页、四种语言。运行 `python3 tests/reader-live/run-wiki-inventory.py --session releasefix --output docs/handoff/wiki-inventory-new.json`，前提同上述已加载源码会话。`wiki-detail-audit.js` 同样是 CLI run-code 函数模板，补查公式、主表、气候表、音频和代码。

这条记录描述调查时的基线状态，不代表当前状态。W01、W02、B01、B03a 已完成；B02 的 fixture、周杰伦与民法典实页抽查通过，苹果公司实测遇 403，见下方记录。

首轮调查记录的追加验证通过：两个 JavaScript 调查模板语法、Python 语法、证据 JSON 解析、交接文档本地链接、发布审计、翻译核心审计及 git diff --check；当时没有修改产品代码。

## W01：维基百科长表与折叠气候表（2026-09-24）

起点提交：`3ee172b`。实现提交：`8945588`。修复前原生扩展 fixture 复现 81 行表被筛掉；79／80 行通过。问题还包括 `innerText` 对隐藏表行返回空、维基 `wikitable` 被通用布局表规则拦截，以及单元格标签中的换行导致清理样式误入阅读器。

改动位于 `content.js` 与 `reader.css`：改用 `textContent` 读取语义表格内容；维基 `table.wikitable` 走专用数据表识别；折叠维基表和超过 80 行或 12000 字的表格放入初始收起的 `<details>`，提供行列数及完整内容展开入口；表格行只在可见时进入渐进翻译；标签清理去除源站切换按钮、样式和多余换行。三线表仍保留原有数据格颜色及文字对比度。

新增自有短文本 fixture：79、80、81、242 行边界；超过 12000 字表；折叠小表；caption、colspan、rowspan；彩色数据格。检查结果为：79／80 行直接呈现，81／242 行和超长表均可展开；隐藏行与合并单元格完整；长表在自身区域滚动，不造成正文横向溢出。纯净、三线、条纹三种表格样式下彩色格均保留。

真实页面：

- [人口列表](https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population)：HTTP 200。源表 242 个物理行，其中一个为空的 `.mw-empty-elt` 间隔行；阅读器保留 241 条有意义记录。World（8,232,000,000，13 Jun 2025）、Norway（5,636,904，30 Jun 2026）和 Pitcairn Islands（UK，35，2023）首／中／末组合字段均匹配，展开后首末记录均可见。
- [伦敦气候](https://en.wikipedia.org/wiki/Climate_of_London)：HTTP 200。9 张源 wikitable 对应 9 张阅读器表；隐藏站点行未丢失，均可通过折叠入口查看。对每张表的首、中、末抽样记录均匹配；源站切换按钮没有进入内容，彩色数据格在三种样式下保持可读。

回归：`wiki-long-tables.js`、`wiki-long-tables-live.js` 通过；`regression.js`、`reader104-regression.js`、`chess-links-citations.js` 通过。涉及引用的 `chess-links-citations.js` 用本机模拟 Google 响应，只验证引用结构与界面，不代表真实翻译服务质量。W01 的 fixture 和实站检查均关闭翻译、只看原文；没有调用真实翻译服务。浏览器检查为 DOM 与交互断言，没有截图验收。原站 sortable 排序交互仍不在本任务范围内。

发布审计、翻译核心审计和 `git diff --check` 在本轮收尾时重跑。没有生成候选 ZIP；实施计划将候选打包留给 R02。W01 收尾时下一项为 W02，W02 后为 B01；当前结果见下方。B03a 后续进入 B02。

## W02：维基百科公式与化学式（2026-09-24）

起点提交：`9aea4c9`。实现提交记录在 [详细实施计划](IMPLEMENTATION-PLAN.md) 第 6 节。本项将 `.mwe-math-element` 仅加入 Wikipedia 的节点收集；段落／表格内的公式留在原文流中，独立公式可单独进入正文。通用 `aria-hidden` 清理仍保持原样。

修复前勾股定理源页有 99 个公式，阅读器没有保留 MathML 或公式图。修复后 Pythagorean theorem 为 99／99 个 MathML 表达式；Solar System 为 7／7、Water 为 4／4、Periodic table 为 12／12，均没有重复输出公式图。四页 HTTP 200，翻译关闭。

勾股定理三个实样的源 → 阅读器对应结构：

- 独立显示公式 `a²+b²=c²`：display block，MathML 含 `msup`；源公式图计算尺寸 108.6 × 23.8 px，阅读器保留平方结构与 alttext。
- 行内公式 `a+b`：display inline，MathML 含 `mi`／`mo`；源图 42.4 × 19.6 px。源基线 −4.23 px，阅读器 −4.71 px，偏差约 0.5 px。
- 分数显示式 `(b+a)²=…+4(ab/2)…`：MathML 含 `mfrac`／`msup`；源图 269.4 × 44.7 px，阅读器保留分数与上标层级。

源页的 MathML 藏在 `display:none` 包装层；可见公式图同时带 `aria-hidden=true`。阅读器优先保留严格白名单清理后的 MathML，去除 annotation 和事件／样式等非白名单属性；只有 MathML 缺失或没有展示节点时才用安全公式图，再降级为可见、带 `role=math` 和 `aria-label` 的文本。图像加载失败时会把带替代文本的图替换为文本。化学 `sub`／`sup` 与引用上标仍按原标记保留。

自有 fixture 覆盖双表示、仅 MathML、行内／独立图像、无图 alttext、坏图、独立根号分数括号、长显示式、H₂O、引用上标和普通隐藏导航：8 个源容器得到 8 个公式表达式，其中 4 个 MathML；没有视觉／无障碍重复公式，坏图退成可见文本，隐藏导航仍过滤。390 px 视口下正文宽 344 px，长 MathML 公式容器自身 `scrollWidth=3034`，长图像公式容器 `scrollWidth=582`，正文均不横向溢出；1280 px 视口内容宽 760 px。深色与白纸主题下 MathML 前景均不同于纸张背景。无截图验收。

HTML 导出保留 MathML、`alttext`、公式图 `alt`、坏图文本和 H₂O 下标；PDF 打印的 `srcdoc` 中检查了相同语义，并确认长公式容器与打印样式规则存在。打印媒体下的实际分页与公式排版未验收，也未落盘实际 PDF。Markdown 将 MathML `alttext` 作为普通替代文本保留，图像使用 alt 文本与链接，H₂O 保留为文本 `H2O`；不宣称转换为正确 LaTeX。导出文件为自有短 fixture，已检查 HTML 和 Markdown 文件内容。

回归：`wiki-math.js`、`wiki-math-live.js`、`wiki-math-export.js` 通过；四个真实页面与 fixture 均关闭自动翻译，不调用模拟或真实翻译服务。发布审计、翻译核心审计、三个 JS 模板语法检查和 `git diff --check` 通过。未生成候选 ZIP；R02 负责候选包。

## B01：百度百科基本信息字段配对（2026-09-24）

起点提交：`dba934f`；实现提交：`2e27712`。修复前 facts 分支只取 `dt.nextElementSibling`，无法收集包装层中的值或同一标签下后续的多个 `dd`；也会为隐藏占位生成空行，并通过删除全部空白把 `Stage name` 压成 `Stagename`。修复后按最近的 `dl` 和下一个 `dt` 界定值节点，合并可见值，跳过隐藏／空字段；标签清理保留英文间隔，值内链接和换行保留。

四个真实样本均 HTTP 200，使用原文模式、自动翻译关闭：周杰伦 24 个源 `dt`／23 个可见字段／23 行输出；水 23／23／23；杭州市 19／19／19；清华大学 29／28／28。周杰伦与清华大学各有一个隐藏项，阅读器没有把它们输出为空行。逐字段比较中，标签顺序、值字符序列（按空白归一）、图片替代文本、链接文字及目标地址一致；实页没有字段差异。页面入口见 [百度样本矩阵](BAIKE-SURVEY.md)。

自有 fixture 有 10 个源标签、7 行可见输出，覆盖紧邻值、包装层、多个 `dd`、链接、长链接、空值、隐藏标签、隐藏值、标签空格与值内换行。390 px 视口下正文宽 344 px，长值区域宽／滚动宽均为 302 px，无正文横向溢出；1280 px 下正文宽 760 px，长值区域宽／滚动宽均为 503 px。扩展保留“Stage name”标签、“林 夏”“Mira Li”中的语义空格。无截图验收。

回归：`baike-facts.js`、`baike-facts-live.js`、更新后的 `reader104-regression.js` 与 `regression.js` 通过；`reader104` 中周杰伦／杭州市／水分别为 23／19／23 项。发布审计、翻译核心审计、四个 JS 模板语法检查及 `git diff --check` 通过。没有调用模拟或真实翻译服务。现有 DOM 中隐藏／未展开字段不承诺保留，维护者仍需抽查中文标签和值的视觉边界。

本轮宽屏追加仅作用于 facts 分支生成的 `.reader-baike-infobox`：文章栏达到 700 px 后，每个字段成为标签／值卡片，两个卡片并排显示；窄栏继续单列。自有 fixture 在 390 px 视口（正文栏 344 px）保持单列，在 1920 px（正文栏 754 px）显示两列卡片，7 个字段配对、长链接换行、没有横向溢出。周杰伦实页有 23 个字段；390 px 下正文栏 344 px、单列无溢出，1920 px 下正文栏 754 px、两列卡片无溢出。通用信息表没有加此站点类，Wikipedia 与通用信息表不会进入此规则。原文模式、自动翻译关闭，无模拟或真实翻译服务调用。

## B02：百度百科标题与大纲定位（2026-09-24，部分完成）

修复前 `collectReaderContentNodes` 会把正文中所有重复文字去重，第二个同名标题因此没有独立目标；页内链接指向标题包装层 ID 时，source anchor 映射只看标题和后代节点，点击会退回原网页。实页还发现阅读器左栏最后一条按钮延伸到系统滚动条之下，行尾点击落在背景层。

改动：仅对标题跳过文本去重，重复标题仍有独立 `head_n`；source anchor 同时映射标题的祖先容器，祖先范围止于选出的正文容器；大纲行宽收回约 12 px 并给 outline scroll view 保留稳定滚动槽，避免系统滚动条挡住最右端按钮。源目录保持排除，不把目录副本插入正文。

自有 fixture 包含 h1、重复 h2、三级标题、长标题、标题外包装 ID、无效目录链接和相隔较远的同名章节。断言通过：正文标题顺序／层级与目标 ID 一致；导航不泄漏；两个同名标题映射到不同 ID；首／中／末、三级、包装锚点与行尾点击均通过；目标保持在可视区；窄／宽栏标题文字完整、按钮宽度不穿过滚动条。

实页周杰伦 HTTP 200：按正文采集边界统计 36 个源标题、阅读器 36 个，层级与顺序一致。唯一排除的是位于 `#J-lemma-starmap` 内的“相关星图”，这是计划明确允许跳过的互动图鉴／星图。首、中、末点击连续 3 帧稳定，目标标题顶边约为阅读区顶边下 28 px；末条“人物评价”的行尾点击通过。民法典此前实测 13/13 标题对应，首／中／末点击也通过。周杰伦源目录有 35 个 `#编号` 链接，这些编号没有对应 DOM ID/name；目录本身不进入阅读器，阅读器大纲从正文标题生成。苹果公司 B02 请求返回 HTTP 403，未绕过或重试，因此 B02 保持部分完成。

`baike-headings.js` 与 `baike-headings-live.js` 分别提供 fixture 和可见实页检查；`run-baike-headings.py --mode fixture` 跑自有样例，`--mode live --names 周杰伦` 可选择性跑已开放的样本，`--wait-for-manual` 仅等待可见百度验证页，不绕过验证。所有 B02 检查均使用原文模式、自动翻译关闭；无模拟或真实翻译服务调用。

## B03a：百度百科同源图片重复归属（2026-09-24，已验证完成）

起点提交：`5eee156`；实现提交：`6c962b5`。苹果公司实页在修复前 HTTP 200，源 `.J-lemma-content` 有 30 个图片节点和 20 张表。重新定位后，发现同一个源 IMG 位于表格 TD 内的 `.para_*` 包装中；以 `3b87e950…` 为例，源中仅 1 个 IMG，祖先链为 IMG → A → `lemmaPicture_*` → `para_*` → TD → TR → TABLE。阅读器把它同时输出在 `reader_table_670` 的 `r_670_cell_0_0` 和独立段落 `r_671`。本次重定位找到 6 个这样的表内图片节点；表格单元格说明与图均因此重复。旧调查 JSON 的 `r_669` 等编号只是旧快照，不作为选择器。

根因是百度百科 `.para_*` 特例无条件收录表内段落，即使其祖先表格已经进入阅读器；媒体索引也按 URL 去重，无法表达不同源 IMG 节点使用同一地址。修复后 `collectReaderContentNodes` 用 WeakSet 记录实际收录的源节点：只有祖先已被收录时才跳过子段落；被过滤的一行表不会阻断子内容。`collectReaderMediaEntries` 改为按 IMG 节点身份去重，让不同图注下合法复用同 URL 的图片各自获得媒体索引。

自有 fixture 使用两行、两图的表格、表外复用其中一个 URL 的独立 figure，以及一行且不会作为表格收录的父表。断言通过：两张表内图各出现一次；复用 URL 在表格和独立 figure 各出现一次；独立图注保留，figure 媒体索引为 2；被过滤的一行父表中的段落与图片仍出现；普通数据表的字段顺序和基本信息一行均保留。`baike-image-ownership.js`、`baike-facts.js`、`regression.js` 均通过。

修复后首次请求苹果公司遇到 HTTP 403「百度安全验证」，没有重试或绕过保护。随后在可见 Chromium 窗口复用已正常打开的苹果公司词条，HTTP 200；测试动态定位到两行表格中的 6 个源 IMG。阅读器输出表格仍为 2 行，每个图片节点恰好出现一次，全部位于同一目标表格内，表格外重复数为 0；六张图片均对应原来的单元格说明。`baike-image-ownership-live.js` 已支持复用当前打开的苹果公司页面，便于在需要时由用户先手动完成百度验证再运行。

`chess-links-citations.js` 通过：真实 Wikipedia 后兵开局棋盘 33 个棋子、原尺寸 208 × 208 px，窄屏棋子坐标保持；自有组合图和引用布局通过。该脚本对 Google 翻译响应使用本机模拟，仅验证引用 DOM，不代表真实服务质量。B03a fixture 均在原文模式、自动翻译关闭下运行，没有真实翻译服务调用。没有在百度 403 后再运行会重新请求多个实页的 `reader104-regression.js`；B01 的四页实测和基本信息 fixture 已单独通过。发布审计、翻译核心审计、三个 JS 语法检查和 `git diff --check` 通过；无截图、未生成候选 ZIP。

## B07 顶部视频轮播局部修正（2026-09-24，部分完成，`ade1e79`）

用户反馈词条顶部视频卡在阅读模式里全部铺开，并可能在封面延迟插入时只留下标题。本轮按用户优先级提前处理 B07 中的顶部轮播子项，不代表正文视频模块或地图已完成。

修复前自有 fixture 有 6 个非克隆卡片和 1 个隐藏克隆；阅读器输出 6 个标题、0 张封面、0 个切换控件。fixture 在进入阅读模式 600 ms 后才插入封面，重现了“文字先出、图后加载”的时序。修复后 `warmBaikeVideoCovers` 只等待首屏 3 项，超时上限 1.1 秒；轮播不在视口时会短暂唤醒加载，结束后恢复页面原滚动位置。渲染按源顺序保留非克隆卡片，阅读器宽屏一组 3 项，窄屏一组 1–2 项；箭头和触控横向滚动切换卡组。

同一 fixture 修复后断言通过：6 张卡顺序完整且克隆被滤掉，迟到封面进入输出，宽屏完整可见 3 项、窄屏可见 1 项，箭头前进到末组并返回首组；无封面卡显示“封面暂未加载”及原网页入口。直连视频有 controls、poster、`preload="none"` 且 `autoplay=false`。从原页滚动位置 480 打开阅读模式后，源页位置仍为 480；轮播后的正文也保留。

真实样本尝试：[水词条](https://baike.baidu.com/item/%E6%B0%B4/34133) 返回 HTTP 403「百度安全验证」，没有绕过或重试。因此真实轮播结构及修复后的实页 DOM 尚未确认。本轮只跑自有 fixture，原文模式、自动翻译关闭，没有调用模拟或真实翻译服务。未做截图验收。

回归：`baike-video-carousel.js`、`regression.js`、`chess-links-citations.js` 通过；后者引用部分使用本机模拟 Google 翻译响应，仅验证译文引用结构，不代表真实翻译质量。发布审计 `release-audit.mjs`、翻译核心审计 `translation-core-audit.mjs`、相关 JS 语法检查与 `git diff --check` 通过。百度顶部视频实页仍为 403，未运行会再次请求多个百度词条的 `reader104-regression.js`。B03a 已有实页复验；B02 的周杰伦与民法典抽查通过，苹果公司样本 403，fixture／点击结果见 B02 记录。未打包或发布。

## B07 与新手指引局部调整（2026-09-24，实页媒体复验待做）

顶部轮播每张卡的“在原网页播放”入口移到标题下方，视频数量并入“词条视频”标题。更新后的 `baike-video-carousel.js` fixture 通过：6 张卡、克隆过滤、缺封面降级、直连视频不自动播放、宽屏 3 卡／窄屏 1 卡、左右箭头、滚动位置、数量标题及链接换行位置均符合断言。

实页在此前一次可见会话中加载正常时，周杰伦词条正文有 19 个 `data-module-type="video"`、40 个 `data-module-type="album"`。正文封面／标题此前被清理为连续段落，组图失去统一宽度。本轮给这两类模块增加百度百科专用卡片与等宽组图；保留同一正文前后的段落，图片不浮在正文侧边，视频封面统一 `16:9`，重复共同说明不逐张重复；媒体索引把共享说明放在第一张，后续图片显示组内序号。新增 `baike-body-media.js` fixture 通过：3 张横／竖／方图片的卡槽宽度差小于 1 px，共用说明只出现一次，媒体索引标签不重复；3 张视频卡片标题与原页入口匹配；宽屏／窄屏均无正文横向溢出。该 fixture 只使用本机 SVG 和原文模式，未调用模拟或真实翻译服务。

重新打开周杰伦词条以检查最终版本时，百度返回 HTTP 403「百度安全验证」。未绕过或重试；最终实页媒体输出尚未验证，B07 整体仍为部分完成。视频卡片保留原网页入口，没有把站内播放器流转为直接媒体。地图未处理。

新手指引更新了开场、网页翻译、分栏对照、沉浸阅读文案；`ZZ` 隐藏胶囊说明移到翻译胶囊页面，`AA` 使用提示留在沉浸阅读页。`playwright-welcome.js` 跑通完整指引步骤，文案、提示位置、分栏、阅读模式、查词与图片 OCR 均通过，页面没有运行时错误。

`regression.js` 自有页面回归通过；`chess-links-citations.js` 本次尝试未完成，在组合图／引用 fixture 中点击“样式”标签时被 `#reader-scroll-area` 遮挡并超时，因此不能记为通过。该脚本会模拟 Google 翻译响应，本次没有完成引用验证，也没有调用真实翻译服务。由于同一轮周杰伦实页已返回 403，没有再运行会请求多个外部实页的 `reader104-regression.js`。发布审计、翻译核心审计、相关 JS 语法检查与 `git diff --check` 通过。通过 `node scripts/build-local.mjs` 更新本机安装版；未生成候选 ZIP、未发布。
