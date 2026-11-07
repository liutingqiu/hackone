# 部署工作流设计评估（是否要加 `.github/workflows/deploy.yml`）

> 作者：运维部「航」｜分支 `feat/ops`｜2026-11-07
> 状态：**只出设计，不启用**（缺 `CLOUDFLARE_API_TOKEN` secret，且部署链路尚未做过首次手工验证）

---

## 1. 结论

**要加，但顺序是：先手工把链路跑通 → 再用 preview 分支演练一次 → 最后才启用生产工作流。**

本轮只落地两样东西：

| 文件 | 作用 | 是否会被执行 |
| --- | --- | --- |
| `.github/workflows/deploy.yml.disabled` | 可直接启用的完整草稿 | **不会**（后缀不是 `.yml`/`.yaml`） |
| `docs/ops/deploy-workflow.md`（本文件） | 评估、启用条件、演练步骤、风险 | 不会（文档） |

## 2. 为什么需要（而不是「本地手工部署就够了」）

| 收益 | 说明 |
| --- | --- |
| 可追溯 | 每次部署绑定 commit SHA，页面上有记录；符合 ROLE「每次部署可追溯到 commit」 |
| 减少人为失误 | 固定 `--branch=main`、固定构建命令、固定产物目录，避免「部署成功了但网站没变」 |
| 守门 | 部署前强制 lint / typecheck / test / 体积预算，坏版本上不去 |
| 演示兜底 | 手工部署失败时，CI 是第二条路径（反之亦然） |
| 评委视角 | Actions 运行记录是「现场真实构建过」的公开证据（org/README §四） |

## 3. 与替代方案的比较

| 方案 | 需要 token | 构建在哪 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- | --- |
| **A. GitHub Actions + Direct Upload**（本设计） | 是（2 个 secret） | GitHub runner | 构建日志公开、与现有 CI 同一套命令、可控 | 需要 token；Actions 会排队 | **推荐** |
| B. Cloudflare Git 集成（CF 自己构建） | 否（授权 GitHub App） | Cloudflare | 少一个 secret | 构建日志在 CF 侧；根目录/构建命令要在 CF 后台配；与现有 CI 重复构建；后台配置不受仓库版本控制 | 备选，不作为主路径 |
| C. 纯本地手工 `wrangler pages deploy` | 是（本地 env） | 本机 | 最快、零排队 | 不可追溯、依赖个人机器环境 | **作为兜底保留**（runbook §4） |

## 4. 工作流设计要点

- 触发：`push: main` + `workflow_dispatch`（手动重发）。**不**在 PR 上部署生产；PR 只跑 CI。
- 权限：`contents: read`、`deployments: write`（最小集）。
- 并发：`concurrency: deploy-production`，`cancel-in-progress: false` —— 生产部署不并行、不互相取消。
- 环境：`environment: production`，便于以后加 required reviewers / 环境保护规则。
- 校验：安装 → lint → typecheck → test → build → 体积预算，**在部署 job 内重复一遍**。
  原因：CI 与本工作流并行，不能假设「CI 绿了」；重复校验约多花 20–30 s，换确定性，值得。
- 部署：`cloudflare/wrangler-action@v4`，命令 `pages deploy web/dist --project-name=hackone --branch=main`。
  - **必须显式 `--branch=main`**：checkout 后是 detached HEAD，不给 branch 会进 preview，生产域不更新。
  - `wranglerVersion: "4"`：与本地 runbook 版本一致，避免 action 默认拉到不兼容主版本。
- 冒烟：部署后轮询 `https://hackone.pages.dev/` 最多 2 分钟，要求 200 且 `index.html` 含 `assets/index-`。
  失败则 job 红，人能看到；**不自动回滚**（见 §6 风险）。
- 汇总：`$GITHUB_STEP_SUMMARY` 写入 commit SHA、deployment URL、生产域，方便截图留痕。

## 5. 启用前置条件（checklist）

- [ ] 仓库 secret 已配：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`（值由 YG 提供，**不要**贴到 issue/聊天/文件里）
- [ ] Pages 项目 `hackone` 已存在（runbook §3 首次部署完成）
- [ ] 已用 `--branch=feat/ops` 在 preview 上跑通过一次真实上传（见 §7 演练）
- [ ] `main` 已开分支保护 / 至少要求 CI 通过（否则谁都能直接推生产）
- [ ] 演示时间窗内确认「启用」这一步本身不是非必要变更（ROLE：演示前 1 小时不做非必要变更）
- [ ] 启用当天在 journal 留痕

## 6. 风险与不做的事

| 风险 | 处置 |
| --- | --- |
| secret 泄露 | token 只存 GitHub Secrets；权限最小化；怀疑泄露立即在 CF 后台 revoke 并换新 |
| 自动部署把坏版本推上生产 | job 内强制校验 + 冒烟；必要时启用 `environment: production` 的 required reviewers |
| 自动回滚制造二次事故 | **v1 不做自动回滚**，只报红；回滚由人按 runbook §6 决策（回滚到哪个版本是业务判断） |
| Actions 排队拖慢演示 | 保留本地手工部署路径（runbook §4），CI 不是唯一通道 |
| 与本项目 CI 重复构建 | 接受（约 30 s）；换来「部署产物一定通过校验」 |
| fork PR 偷 secret | 工作流只在 `push: main` 与手动触发时运行，PR 不触发；不要改成 `pull_request_target` |

## 7. 演练计划（启用前必做，约 10 分钟）

```bash
# 1) 在 feat/ops 分支上，用 CLI 发一次 preview（不碰生产域）
npx wrangler@4 pages deploy web/dist --project-name=hackone --branch=feat-ops
#    期望：https://feat-ops.hackone.pages.dev 可访问

# 2) 启用工作流后，先 workflow_dispatch 手动跑一次，确认：
#    - 走的是 main 的 commit
#    - smoke test 绿
#    - GitHub 上出现 deployment 记录（指向 hackone.pages.dev）

# 3) 故意制造一次失败（例如临时把体积阈值调低），确认 job 会红、不会上传
# 4) 复原，再跑一次绿，才算演练完成
```

## 8. 若最终决定「不加」

那就把 runbook §4 的手工部署作为唯一路径，并在 runbook 里补一条「每次部署后手动记录 deployment URL」。
但 ROLE 要求「每次部署可追溯到 commit」，手工方式依赖人自觉，**不建议**。

---

## 附：启用命令

```bash
git mv .github/workflows/deploy.yml.disabled .github/workflows/deploy.yml
git commit -m "ci(ops): 启用 Cloudflare Pages 生产部署工作流"
git push origin feat/ops      # 走 PR，不直接推 main
```
