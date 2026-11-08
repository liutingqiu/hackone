# 拼豆图纸工具 · 作品说明

> 一句话：把一张图变成能拼的图纸——自动分板、每板一页 A4、进度可标、38 字符短链分享。
> 在线：https://hack.liutingqiu.xyz ｜ 仓库：https://github.com/liutingqiu/hackone ｜ 路演页：https://hack.liutingqiu.xyz/pitch/

---

## 一、技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 形态 | 单文件 HTML | 一个 435 KB 的 HTML，内含样式、脚本、开屏动画；断网双击可用 |
| 语言 | 原生 JavaScript（ES2020）/ HTML5 / CSS3 | 不引入任何前端框架，无运行时依赖 |
| 渲染 | Canvas 2D | 网格、色号、A4 分页、进度卡片全部画在 canvas 上 |
| 存储 | IndexedDB + localStorage | IndexedDB 存多画布文档与进度；localStorage 存偏好、折叠状态 |
| 服务端 | Cloudflare Workers + KV | 只做短链：上传/读取，单图上限 400 KB，TTL 180 天 |
| 部署 | Cloudflare Pages | 生产域名 hack.liutingqiu.xyz |
| 构建 | Python 3 模板拼装 | app_template.html + palettes.json → 单文件产物 |
| 测试 | node:test | 运行时回归，覆盖配色、分板、进度、短链编解码 |
| CI | GitHub Actions | 构建 → 产物与 product/ 逐字节比对 → 跑回归 |
| 适配 | 媒体查询 + Pointer Events | 三档桌面/平板列宽、竖屏抽屉、双指缩放、触控热区 |

依赖清单：运行时不加载任何第三方库；构建只用到 Python 标准库；CI 只用到 Python 3.12 与 Node 22。

---

## 二、功能亮点

### 1. 图片到色号，按标准色板走

- 9 个品牌、1751 个颜色：国产标准 291（2.6mm）、Hama 50（5mm）、Perler 70（5mm）、Artkal-S、卡卡、诗诗、童趣、优肯、DMC 508。
- 配色算法可选 CIEDE2000 / Lab 欧氏 / RGB 加权，默认 CIEDE2000。
- 取样与缩放可选最近邻/箱式，最多色数可调（0 表示不限）。

### 2. 分板：每块 29×29，每板一页 A4

- A4 画布 1240×1754，对应 210×297mm，按 100% 打印不缩放。
- 每页含：板号（第几行第几列）、全局坐标、逐格色号、本板用色统计、10cm 比例尺、相邻板提示。
- 页数上限 16 页（移动端 8 页），超出会提示缩小图纸，避免一次打印几百页。

### 3. 拼装进度，撤销不清零

- 进度按格子位置记录成位图，撤销、整理、重新识别都不丢。
- 只有画布尺寸真的变了才重置。
- 标满一块板会提示「第 N 块板拼完了」，右侧进度条同步。

### 4. 编辑工具

- 铅笔、橡皮、吸色、直线、矩形、圆形、油漆桶、左右翻转。
- 撤销/重做基于笔画快照，撤销一步只回退一步。
- 「整理」按 ΔE 合并相近色，把 48 色压到 20 色这类操作一步完成。

### 5. 分享：38 字符，微信直接发

- 图片压缩成紧凑文本，上传到 Cloudflare KV，换回短链。
- 链接形如 hack.liutingqiu.xyz/#s=xxxxxxx，38 字符，180 天有效。
- 对方打开即还原图纸，不需要装应用、不需要注册。

### 6. 拍照核验

- 拍拼好的实物，按 ΔE 与图纸比对，标出颜色不符的格子。

### 7. 多画布与自动保存

- 一个浏览器里存多张图纸，随时切换。
- 每次改动入库，写入失败自动重试，关掉再开还在。

### 8. 平板与触控

- 三档列宽：1280 以上 300/302，1024–1279 256/260，1100 以下 240/244。
- 900 以下转单列 + 抽屉；双指捏合缩放，捏合不会误落笔。
- 左右工作区可单独收起，画布随之变大，收起状态记忆。

### 9. 开屏动画

- Canvas 绘制的多光标开屏：九个色点组成 logo，多支光标把界面「搭」出来。
- 点击或 Esc 跳过，12 秒兜底。

---

## 三、运行方式

### 1. 直接用（推荐）

打开 https://hack.liutingqiu.xyz ，无需注册。手机、平板、桌面浏览器均可。

### 2. 离线单文件

下载仓库里的 product/index.html，双击用浏览器打开即可，功能与线上一致（短链分享需要联网，其余全部本地）。

### 3. 本地开发

    git clone https://github.com/liutingqiu/hackone
    cd hackone
    python3 app/build_html.py          # 生成 app/拼豆图纸工具.html
    cp app/拼豆图纸工具.html product/index.html

改的是 app/app_template.html（模板）与 app/palettes.json（色板），产物由脚本拼装，不要直接改产物。

### 4. 测试

    node --test tests/runtime.test.cjs

### 5. 部署

    npx wrangler pages deploy ./product --project-name hackone --branch main

短链服务单独部署：

    cd share
    npx wrangler deploy

### 6. 环境要求

- 构建：Python 3.9+（仅标准库）
- 测试：Node 18+
- 部署：Cloudflare 账号（wrangler 已登录）

---

## 四、目录结构

    app/        源码：模板、色板、构建脚本、产物
    product/    部署目录：index.html 与路演页 pitch/
    share/      短链 Worker（Cloudflare Workers + KV）
    tests/      运行时回归
    docs/       发布说明、平板调研、12 栅格、路演方案
    archive/    历史版本快照（1.1 / 2.0 / 2.1 / web）
    tools/      辅助脚本

---

## 五、性能与边界

| 项 | 数值 |
| --- | --- |
| 单文件体积 | 435 KB |
| 单图画布上限 | 400 × 400 格（16 万格） |
| A4 页数上限 | 16 页（移动端 8 页） |
| 短链体积上限 | 400 KB，180 天 |
| 首屏 | 无网络请求、无字体下载，开屏动画约 4.5 秒（可跳过） |

已知限制：

- 拍照核验假定照片已拍正、裁到图纸边缘，斜拍会失准。
- 短链依赖外网，无网时退回文件导入/导出。
- 超过 300×300 的图纸首帧渲染偏重，未做分块渲染。
