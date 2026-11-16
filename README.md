# 拼豆图纸工具 · 平板 APK

把单文件网页 `拼豆图纸工具.html` 包装成 Android 平板 APK，并针对触摸/横屏做了适配。
原始网页未改动，平板版是独立副本 `tablet/index.html`。

## 产物

| 文件 | 说明 |
| --- | --- |
| `dist/拼豆图纸-平板.apk` | 可直接安装的 APK（调试签名，181 KB，v1.0.2） |
| `dist/pindou-tablet.apk` | 同上，ASCII 文件名，方便命令行/脚本 |
| `tablet/index.html` | 平板版网页（可单独用浏览器打开） |
| `拼豆图纸工具.html` | 原网页，保持原样 |

## 平板适配做了什么

- **三栏按比例**：`--lw/--rw = clamp(180px, 19.55vw, 280px/289px)`（比最初 23vw 收窄 15%），
  1600 宽时左右各 280px，1280 宽时各 250px，1024 宽时各 200px，800 宽时各 180px；
  中间画布自动占满剩余宽度（含折叠动画同步）。
- **断点重排**：`≥761px` 三栏常驻（平板），`<761px` 回落为原来的手机单列，互不干扰。
- **触控热区**：`pointer: coarse` 下按钮/输入/开关/色卡格子放大到 37–46px，
  行高 46px，字体 13–14px；`#bar`/`#modebar` 内的按钮再缩 20%（37×32 / 37×34），保证横屏单行。
  顶部条不再显示「网格尺寸 / 颗粒数 / 底板块数 / 坐标取色」，把宽度让给按钮。
- **全屏**：`windowFullscreen` + `systemUiVisibility` 沉浸式隐藏状态栏/导航栏（边缘滑动可临时呼出），不再有顶部白条。
  不使用 API 30 的 `WindowInsetsController`，避免老系统类校验失败。
- **画布手势**：单指按当前工具绘制/擦除/标记；「查看」工具单指拖动平移；
  双指捏合缩放 + 双指平移（复用原有滚轮缩放的锚点缓动）。
- **统一导入**：底部居中的「导入」按钮打开系统文件管理（`*/*`），
  可直接选图片 / ZIP / TXT / JSON 图纸，按文件类型自动分流；
  空状态不再放「导入图片 / 新建空白图纸 / 拖进来或 Ctrl+V」这些中间按钮与提示。
- **导出走原生**：PNG → 相册 `Pictures/拼豆图纸`；ZIP/TXT → `Download/拼豆图纸`；
  A4 拼装图 → 直接合成 A4 PDF 并分享；保存后自动弹系统分享面板。
- **外部链接**（淘宝/GitHub）交给系统浏览器；返回键先关浮层再退出。

## 目录结构

```
tablet/index.html        平板版页面（构建时复制进 APK 的 assets/www/）
android/
  AndroidManifest.xml    包名 com.pindou.pattern，minSdk 24 / targetSdk 34
  res/                   图标、主题、网络安全配置
  src/com/pindou/pattern/
    MainActivity.java    WebView 外壳、文件选择、外链、返回键
    AssetServer.java     127.0.0.1 本地静态服务（给页面正常 http 源）
    NativeBridge.java    window.NativeSave 暴露给页面的方法
    Exporter.java        MediaStore 保存、分享、A4 PDF 合成
    ShareProvider.java   Android 9 及以下的 content:// 分享
build-apk.sh             一键构建（aapt2 → javac → d8 → zipalign → apksigner）
tools/                   图标生成、打包、浏览器端验证脚本
dist/                    产物与验证截图
```

## 重新构建

```bash
bash build-apk.sh
```

依赖（本机已装）：

- JDK 17（运行 d8/apksigner），JDK 8（javac，build-tools 34 的 d8 对 JDK 17 的
  `MethodParameters` 有 NPE，故用 JDK 8 编译）
- Android SDK：`D:/app/AndroidSdk`（platform-tools、platforms;android-34、build-tools;34.0.0）

## 安装
把 APK 传到平板点击安装

## 浏览器端验证（无需真机）

```bash
node tools/verify-layout.js   # 1280×800 / 1024×768 / 800×1280 / 700×1000 布局+触摸绘制+双指缩放
node tools/verify-bridge.js   # 假 NativeSave，验证 PNG/A4 导出会走原生桥
node tools/shots-import.js    # 导入示例图并截图
node tools/verify-import.js   # 图片 / TXT / ZIP 三种导入往返校验
```
