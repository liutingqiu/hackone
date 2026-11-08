# 拼豆图纸工具

把一张图片变成可以照着摆的拼豆图纸：每个格子标出色号，可手改、可导出、可打印。

## 直接使用

双击 **`app/拼豆图纸工具.html`**（Chrome / Edge 均可）。

单文件、离线可跑、不上传任何图片——整个工具就是那一个 317.7 KB 的 HTML。

## 功能

- **导入**：把图片拖进窗口，或 `Ctrl+V` 粘贴；没有图纸时主工作区显示水印引导
- **画布缩放**：主工作区滚轮放大 / 缩小，以光标下的格子为锚点，缓动先快后慢
- **色号标注**：9 套色板 / 1751 色，格子标色号，点格子可查跨品牌对照
- **手改保留**：改尺寸、换品牌、限色之后，手改过的格子不丢，全程可撤销
- **绘制工具**：查看 / 铅笔 / 橡皮 / 吸色 / 直线 / 矩形 / 圆形 / 填充，左右翻转；工具栏固定在画布顶部
- **界面**：左右栏按分组做成卡片，卡片之间留白；每张卡片可折叠，按钮在标题右侧，状态本地记忆
- **拼装进度**：标记模式按住拖动连续标记（笔尖 1 格，快速拖动不漏格），起笔那格决定标记 / 取消；进度存本地，刷新可恢复
- **配色整理**：相近色聚类合并、孤立杂色清理；用量清单点「替换」弹出色卡，色卡正上方浮出同宽的相近色推荐，点一下直接换掉整色
- **A4 分板拼装图**：按 29×29 或 52×52 底板切分，编板号，导出多页 A4
- **导出**：图纸 PNG（含坐标、色号、板界线、用量清单）、用量 CSV、采购清单

## 目录

```
app/                     成品与源码
  拼豆图纸工具.html        成品，双击即用（构建产物，勿直接改）
  app_template.html      源码模板，含 __PALETTE_JSON__ 占位符
  palettes.json          9 套色板数据（构建产物）
  build_html.py          模板 + 色板 → 成品 HTML
  build_palettes.py      原始色卡 → palettes.json
  color_math.py          sRGB→Lab、CIEDE2000、HEX 处理
  fetch_data.py          从上游仓库抓原始色卡到 data/raw/
  data/raw/              原始色卡（19 个文件，1.5 MB）
preview/                 界面验证截图（桌面 / 工具栏 / 移动端）
web/                     React + Vite 重写版（另有「小白 / 专业」双模式）
.github/workflows/ci.yml web/ 的 CI（lint / typecheck / test / build）
```

## 修改与重新构建

改功能改 `app/app_template.html`，**不要**直接改成品 HTML——下次构建会被覆盖。

```bash
cd app
python build_html.py        # 模板 + palettes.json → 拼豆图纸工具.html
```

色板需要重算时（依赖 `data/raw/`，首次或上游数据更新后）：

```bash
cd app
python fetch_data.py        # 上游色卡 → data/raw/（已存在的跳过）
python build_palettes.py    # 原始数据 → palettes.json，并打印交叉校验报告
python build_html.py        # → 拼豆图纸工具.html
```

只依赖 Python 3 标准库，无需第三方包。构建结果可复现：成品为纯 LF、325362 字节。

## 色板数据

共 9 套色板 / 1751 色，全部来自公开社区色卡，**不是厂商光谱实测值**。

| 色板 | 色数 | 说明 |
|---|---|---|
| 标准 291 | 291 | MARD 体系，同时带 MARD / COCO / 漫漫 / 盼盼 / 咪小窝 五套色号 |
| Hama | 50 | 5 mm |
| Perler | 70 | 5 mm |
| Artkal S | 35 | 2.6 mm 软豆 |
| 卡卡 | 284 | |
| 柿柿 | 219 | |
| 童趣 | 120 | |
| 优肯 174 | 174 | Artkal 旧编号 |
| DMC 508 | 508 | 十字绣色卡，配色参考用 |

数据来源：

- [Zippland/perler-beads](https://github.com/Zippland/perler-beads) — `colorSystemMapping.json`（291 标准色 × 5 品牌色号）
- [LunarXuan/Pindo](https://github.com/LunarXuan/Pindo) — `lib/data/palettes/` 下 8 套色板，并用于交叉校验
- [abearxiong/get-colors-from-beans](https://git.xiongxiao.me/abearxiong/get-colors-from-beans) — `colorMap.json`（卡卡 / 柿柿 / 童趣 / 优肯 / DMC）
- [Jett-Wu/Perler_Beads_Generator](https://github.com/Jett-Wu/Perler_Beads_Generator) — 第三方校验

已知分歧：`小舞` / `黄豆豆` / `DODO` 三家色号与 MARD 291 逐号一致（同一套色卡换名），
但与上表采用的 MARD 291 只有 17/291 个 HEX 完全相同——同品牌不同批次，故不合并。
HEX 只是屏幕近似值，下单前请核对实体色卡。