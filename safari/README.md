# Safari 版

同一份扩展源码同时用于 Chrome 和 Safari。这个目录里的 Xcode 工程由 `scripts/build-safari.sh` 生成，引用的是 `safari/web-extension/`（脚本每次从源码复制，不进 Git）。

## 日常

```bash
scripts/build-safari.sh            # 复制最新源码到 safari/web-extension/
scripts/build-safari.sh --build    # 复制并编译 macOS 版（未签名，本机自测用）
scripts/build-safari.sh --rebuild  # 新增或删除了扩展文件后，重新生成工程
```

改完扩展代码后先跑第一条，再在 Xcode 里运行。App 版本号会自动与 `manifest.json` 同步。

`--rebuild` 会重新生成工程，会丢掉手工改动：中文显示名“极简翻译”（各目标的 `INFOPLIST_KEY_CFBundleDisplayName`）和 `Shared (App)/Resources` 里的中文说明页。重新生成后用 `git diff` 找回这两处。

## 本机先试（开发者账号批下来之前）

1. `scripts/build-safari.sh`，然后用 Xcode 打开 `safari/Jijian Translate/Jijian Translate.xcodeproj`。
2. 选 “Jijian Translate (macOS)” 方案，点运行，会打开一个小 App 窗口。
3. Safari → 设置 → 高级，勾选“显示网页开发者功能”；菜单栏“开发” → “允许未签名的扩展”（每次重启 Safari 都要重新勾选）。
4. Safari → 设置 → 扩展，勾选“极简翻译”，并允许访问网站。

## 账号批下来以后

1. Xcode 里四个目标（macOS／iOS 的 App 与 Extension）在 “Signing & Capabilities” 选择你的 Team。
2. 默认 Bundle ID 是 `com.cuteraccoons.JijianTranslate`；要改的话在生成前设置 `SAFARI_BUNDLE_ID` 再运行 `scripts/build-safari.sh --rebuild`，或直接在 Xcode 里改（App 与 Extension 的前缀要一致）。
3. Product → Archive，在 Organizer 里上传到 App Store Connect；在 App Store Connect 填写说明、隐私与截图后提交审核。macOS 与 iOS 可以作为同一个 App 的两个平台上架。

## 与 Chrome 版的差异（已在代码里处理）

- 图片 OCR：Safari 不支持 manifest `sandbox`，打包时去掉该键；`ocr-sandbox.js` 发现没有沙盒时改用 `ocr-worker.js`。
- 本地词典：Safari 没有文件夹授权接口，“添加文件／添加文件夹”会把 MDX／MDD／CSS 复制进扩展存储。
- 网站权限：Safari 默认逐站授权；未授权时 Popup 会提示去地址栏旁的扩展按钮里允许。
- iPhone／iPad：长按选中文字后，查词与高亮工具条出现在选区下方。

## 尚未在真实 Safari 里验证

macOS 与 iOS 工程都能编译；同一份暂存文件在 Chromium 中模拟“无沙盒”运行通过了 OCR、阅读模式与查词测试。但还没有在真正的 Safari 里运行过，请在第一次本机试用时重点看：图片 OCR、阅读模式、Popup、本地词典导入。
