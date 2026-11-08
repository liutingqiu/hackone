# 拼豆图纸工具 · hackone

把一张图变成能拼的图纸：**自动分板、每板一页 A4、拼装进度可标可核验、38 字符短链分享**。

| | |
| --- | --- |
| 在线使用 | <https://hack.liutingqiu.xyz> |
| 离线使用 | 双击 `product/index.html`，单文件，无需联网 |
| 发布说明 | [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md) |
| 作者 | [@liutingqiu](https://github.com/liutingqiu) · [@sshanersshaner](https://github.com/sshanersshaner) |

## 目录

```
.
├── app/            单文件应用源码（app_template.html + palettes.json）与构建脚本
├── product/        构建产物，直接部署到 Cloudflare Pages
├── share/          分享短链服务（Cloudflare Worker + KV）
├── tests/          运行时回归（node --test）
├── tools/          小工具（journal.sh 等）
├── docs/           计划、决策、发布说明、调研、评审材料
├── org/            部门流水线与交接约定
├── journal/        每日工作留痕
├── reference/      参考实现与色板来源
├── archive/        历史快照（1.1 / 2.0 / 2.1）、废弃的 web 版、旧离线包
├── .github/        CI：构建 + 产物一致性 + 运行时回归
└── README.md
```

## 快速开始

```bash
git clone https://github.com/liutingqiu/hackone.git
cd hackone

open product/index.html            # 直接看效果，不用装任何依赖
python3 app/build_html.py          # 改完源码重新构建
node --test tests/runtime.test.cjs # 跑运行时回归
```

应用没有构建链、没有框架依赖：源码是 `app/app_template.html` 一个文件，构建脚本把
`palettes.json` 注入后产出 `app/拼豆图纸工具.html`，再复制到 `product/index.html`。

## 部署

```bash
python3 app/build_html.py
cp app/拼豆图纸工具.html product/index.html
npx wrangler pages deploy ./product --project-name hackone --branch main

cd share && npx wrangler deploy     # 短链 Worker（KV，180 天过期，单张上限 400 KB）
```

## 画布操作

| 操作 | 手势 |
| --- | --- |
| 平移（放大后拖动画布） | 中键拖动 / 空格 + 左键拖动 / 「查看」工具下左键拖动 |
| 缩放 | 滚轮（以光标为中心） |
| 适应窗口 | 右上角「显示设置」→ 适应窗口 |

## 工具与标记

画布上「点格子做什么」只有一档状态：工具条。没有独立的「浏览 / 标记」模式。

| 工具 | 点格子会怎样 |
| --- | --- |
| 查看 | 看色号、坐标、用量，不改任何东西（也是平移用的工具） |
| 标记 | 标记「这格拼好了」/ 再点取消，拖动可连续标记；只记进度，不改图案 |
| 铅笔 / 橡皮 / 吸色 / 直线 / 矩形 / 圆形 / 连选填色 | 改图案 |
| 翻转 | 动作按钮，左右镜像图案；已标记的进度会跟着镜像 |

进度按格子位置记录：整理配色、重新识别、撤销都不会把它清零；画布尺寸变了才重置。

## 协作约定

| 事项 | 约定 |
| --- | --- |
| 主分支 | `main`，保持随时可运行 |
| 开发 | 每人开特性分支：`feat/xxx`、`fix/xxx` |
| 提交 | 一次提交只做一件事，信息写清「改了什么、为什么」 |
| 合并 | 通过 Pull Request 合并，至少 1 人看过 |
| 冲突 | 每天开工前先 `git pull --rebase` |

## 文档

- 发布说明：[docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md)
- 方案与决策：[docs/PLAN.md](docs/PLAN.md)、[docs/decisions.md](docs/decisions.md)、[docs/adr.md](docs/adr.md)
- 评审与测试：[docs/qa/](docs/qa/)、[docs/user-testing/](docs/user-testing/)
- 工作留痕：[journal/](journal/)
