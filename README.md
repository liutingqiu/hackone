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


## CI（两层）

**本地 CI**（默认生效，零依赖）：推送前自动跑，不依赖 GitHub。

```bash
git config core.hooksPath .githooks   # 每台机器执行一次
.ci/check.sh          # 手动跑全量
.ci/check.sh --fast   # 跳过依赖安装（日常）
```

**GitHub Actions**：`.github/workflows/ci.yml`，push / PR 自动触发。
它在 GitHub 服务器上跑，故障时会排队或失败——这就是本地那层存在的理由。
需要看日志：`gh run list` / `gh run view <id> --log-failed`

## 目录

```
.
├── README.md
├── docs/          # 方案、接口、分工
└── .gitignore
```