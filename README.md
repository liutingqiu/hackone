# hackone

黑客松项目仓库（团队协作）。

## 快速开始

```bash
git clone https://github.com/liutingqiu/hackone.git
cd hackone
```

## 协作约定

| 事项 | 约定 |
| --- | --- |
| 主分支 | `main`，保持随时可运行 |
| 开发 | 每人开特性分支：`feat/登录页`、`fix/接口超时` |
| 提交 | 一次提交只做一件事，信息写清楚「改了什么、为什么」 |
| 合并 | 通过 Pull Request 合并，至少 1 人看过 |
| 冲突 | 每天开工前先 `git pull --rebase`，别攒着 |

### 常用命令

```bash
git switch -c feat/你的功能     # 开新分支
git add -A && git commit -m "feat: 说明"
git push -u origin feat/你的功能  # 首次推送
git switch main && git pull --rebase
```


## CI

GitHub Actions：`.github/workflows/ci.yml`，push 到 `main` / `feat/**` 或开 PR 时自动跑（装依赖 → build → typecheck/lint → test）。

```bash
gh run list                       # 最近的运行
gh run view <id> --log-failed     # 只看失败的步骤
gh run watch <id>                 # 盯着它跑完
```

## 目录

```
.
├── README.md
├── docs/          # 方案、接口、分工
└── .gitignore
```
## 部署

应用是单文件 HTML，构建后直接同步到 Pages：

```bash
python3 app/build_html.py
cp app/拼豆图纸工具.html product/index.html
npx wrangler pages deploy ./product --project-name hackone --branch main
```

分享短链由独立 Worker 承担（KV 存图纸，180 天过期，单张上限 400 KB）：

```bash
cd share && npx wrangler deploy     # https://pinda-share.tianqi689.workers.dev
```

线上：https://hack.liutingqiu.xyz

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
