# archive/hbb-2026-11-14/ — 队友 11-14 推送的另一个版本（仅产物）

## 这是什么

2026-11-14 21:23，仓库协作者 `SShaner0903` 往 `main` 推了 3 个提交，
把 `app/拼豆图纸工具.html`（构建产物）换成了另一份构建结果，**但没有提交对应的 `app_template.html`**。

| 提交 | 说明 |
| --- | --- |
| `dd389f2` | feat(app): 更新拼豆图纸工具单文件版（更流畅的交互版本） |
| `5605e49` | feat(app): 用更流畅的改进版替换拼豆图纸工具单文件成品 |
| `3b44a6f` | chore: 移除根目录误传的同名文件（正本在 app/） |

## 为什么单独存一份

这个版本**不是** v1.5 或 v1.6，而是一条独立演进的代码线，含主线没有的功能：

| 功能 | 对应函数 |
| --- | --- |
| ZIP 工程文件导入导出（自带 deflate/inflate + CRC32） | `buildZip` `inflateRaw` `deflateRaw` `crc32` `isZip` |
| 文本工程格式解析 | `parseText` `buildText` `applyParsed` `tokenizeConcat` |
| 标记图层（可单独重建/绘制） | `floodFillMark` `markBrush` `beginMarkStroke` `rebuildMarkBuffer` `syncMarkLayer` |
| 工具/图层分离 | `selectTool` `setLayer` `syncPaintbar` `syncStageSize` |
| PNG 图例排版 | `pngLegendItems` `pngLegendRows` `pngLegendItemWidth` |

它**没有**主线 v1.6 的东西：无四角透视校正（`quadHomography`）、无脏行重绘（`resampleProgress` / `dr`）、
无竖屏抽屉把手（`drawer-tab`）。

## 关键事实（不要误判）

1. **CI 会在构建时把它覆盖掉**。`ci.yml` 先跑 `python3 app/build_html.py`（从模板生成 459,080 字节），
   再和 `product/index.html` 比对。所以那份 451,959 的文件在 CI 里活不过第一步，
   CI 显示 success 并不代表它被保留。
2. **它的源码不在仓库任何分支上**。逐个分支查过 `app_template.html`，没有一个含 `buildZip` / `floodFillMark`。
3. **`product/index.html`（实际部署的东西）始终是主线版本**，从未包含这个分支的功能。

## 想把这些功能并回主线，需要

- 拿到产生这份产物的 `app_template.html`（本机或队友本地），提交上来；
- 或者以本文件为参考，把 ZIP 导出、标记图层等逐块移植进 `app/app_template.html`；
- 移植后必须 `python3 app/build_html.py` 重建，并让 `node --test tests/runtime.test.cjs` 全绿，
  不能直接提交产物。

sha256：`66ba28066762576318446bdb27cfd4f6aab7610cfea6401a2bd8977bb2108615`
