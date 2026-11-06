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

## 目录

```
.
├── README.md
├── docs/          # 方案、接口、分工
└── .gitignore
```
