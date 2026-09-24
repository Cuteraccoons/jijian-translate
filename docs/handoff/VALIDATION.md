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

这条记录描述调查时的基线状态，不代表当前状态。W01 已完成，见下方记录；数学公式仍待 W02。

首轮调查记录的追加验证通过：两个 JavaScript 调查模板语法、Python 语法、证据 JSON 解析、交接文档本地链接、发布审计、翻译核心审计及 git diff --check；当时没有修改产品代码。

## W01：维基百科长表与折叠气候表（2026-09-24）

起点提交：`3ee172b`。实现提交：`8945588`。修复前原生扩展 fixture 复现 81 行表被筛掉；79／80 行通过。问题还包括 `innerText` 对隐藏表行返回空、维基 `wikitable` 被通用布局表规则拦截，以及单元格标签中的换行导致清理样式误入阅读器。

改动位于 `content.js` 与 `reader.css`：改用 `textContent` 读取语义表格内容；维基 `table.wikitable` 走专用数据表识别；折叠维基表和超过 80 行或 12000 字的表格放入初始收起的 `<details>`，提供行列数及完整内容展开入口；表格行只在可见时进入渐进翻译；标签清理去除源站切换按钮、样式和多余换行。三线表仍保留原有数据格颜色及文字对比度。

新增自有短文本 fixture：79、80、81、242 行边界；超过 12000 字表；折叠小表；caption、colspan、rowspan；彩色数据格。检查结果为：79／80 行直接呈现，81／242 行和超长表均可展开；隐藏行与合并单元格完整；长表在自身区域滚动，不造成正文横向溢出。纯净、三线、条纹三种表格样式下彩色格均保留。

真实页面：

- [人口列表](https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population)：HTTP 200。源表 242 个物理行，其中一个为空的 `.mw-empty-elt` 间隔行；阅读器保留 241 条有意义记录。World（8,232,000,000，13 Jun 2025）、Norway（5,636,904，30 Jun 2026）和 Pitcairn Islands（UK，35，2023）首／中／末组合字段均匹配，展开后首末记录均可见。
- [伦敦气候](https://en.wikipedia.org/wiki/Climate_of_London)：HTTP 200。9 张源 wikitable 对应 9 张阅读器表；隐藏站点行未丢失，均可通过折叠入口查看。对每张表的首、中、末抽样记录均匹配；源站切换按钮没有进入内容，彩色数据格在三种样式下保持可读。

回归：`wiki-long-tables.js`、`wiki-long-tables-live.js` 通过；`regression.js`、`reader104-regression.js`、`chess-links-citations.js` 通过。涉及引用的 `chess-links-citations.js` 用本机模拟 Google 响应，只验证引用结构与界面，不代表真实翻译服务质量。W01 的 fixture 和实站检查均关闭翻译、只看原文；没有调用真实翻译服务。浏览器检查为 DOM 与交互断言，没有截图验收。原站 sortable 排序交互仍不在本任务范围内。

发布审计、翻译核心审计和 `git diff --check` 在本轮收尾时重跑。没有生成候选 ZIP；实施计划将候选打包留给 R02。下一项为 W02 公式。
