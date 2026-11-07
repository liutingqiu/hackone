# 部署 Runbook · hack.liutingqiu.xyz

> 维护：运维部「航」（ops）｜分支 `feat/ops`
> 状态：**链路已就绪，尚未真正部署**（等 YG 确认凭据后再执行）
> 决策依据：[ADR-002](../adr.md)（Cloudflare Pages 静态托管）、[ROLE.md](../../org/ops/ROLE.md)
> 最后更新：2026-11-07

---

## 0. 一页速查

| 项 | 值 |
| --- | --- |
| 代码仓库 | `hackone`，生产分支 `main` |
| 构建目录 | `web/`（Node 22） |
| 构建命令 | `npm --prefix web ci && npm --prefix web run build` |
| 产物目录 | `web/dist`（已 gitignore） |
| 部署目标 | Cloudflare Pages，项目名 **`hackone`** |
| 线上地址 | `https://hackone.pages.dev`（Pages 默认）+ `https://hack.liutingqiu.xyz`（自定义域） |
| 配置文件 | 根目录 [wrangler.toml](../../wrangler.toml) |
| 部署方式 | Direct Upload（本地 CLI 或 GitHub Actions） |
| 回滚粒度 | 单次 deployment（Cloudflare 保留历史部署，可一键回滚） |

**本轮未做的事（有意为之）**：未创建 Pages 项目、未登录 Cloudflare、未安装 wrangler、未改 DNS。
原因：凭据需 YG 确认；且 ROLE 规定「无备份不改 DNS」「演示前 1 小时不做非必要变更」。

---

## 1. 前置条件与凭据清单

### 1.1 需要 YG 提供的凭据（三选一，推荐 A）

| 方案 | 需要什么 | 是否需要 token | 适用场景 |
| --- | --- | --- | --- |
| **A. API Token（推荐）** | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | 是 | 本地部署 + CI 自动化，可无头运行 |
| B. OAuth 登录 | 本机浏览器完成 `wrangler login` | 否 | 只做一次本地演示部署，最省事 |
| C. Git 集成 | 在 Cloudflare 后台授权 GitHub App | 否 | 以后想让 CF 自己构建（本项目**不建议**，见 §7） |

**创建 Token 的最小权限**（Dashboard → My Profile → API Tokens → Create Token → Custom）：

| 权限 | 范围 | 为什么 |
| --- | --- | --- |
| Account · Cloudflare Pages · Edit | 账号级 | 建项目、上传部署、回滚 |
| Zone · DNS · Edit | `liutingqiu.xyz` | **仅首次绑域名时需要**（同账号下 Pages 会自动建 CNAME；手动建记录则必须） |
| Zone · Zone · Read | `liutingqiu.xyz` | 只想做自动化健康检查时可加，非必需 |

> 不勾 `Account Settings`、不勾 `Workers Scripts`、不勾全 `Zone`，避免过度授权。
> Token 只显示一次，拿到后立刻存进 GitHub Secrets（§8）并本地 `export`，不要写进任何文件。

### 1.2 Account ID 从哪来

Dashboard → 任一 Zone 概览页 → 右侧 **API** 区域 → **Account ID**（32 位 hex）。
也可用已登录会话查询：`curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts`。

### 1.3 本机环境现状（已核实，2026-11-07）

| 项 | 现状 |
| --- | --- |
| Node / npm | v22.23.4 / 10.9.9 |
| npm registry | `web/.npmrc` 指向 `https://registry.npmmirror.com`（国内直连官方源 >160s，已实测） |
| wrangler | **未安装**（全局、本地均无）。用 `npx` 首次拉取需走 npmmirror，预计 1–5 分钟，**装之前先问 YG** |
| 域名 DNS | `liutingqiu.xyz` 的 NS 已是 `elly.ns.cloudflare.com` / `ivan.ns.cloudflare.com`（Cloudflare 托管，绑定域名会很顺） |
| `hack` 子域 | **当前无任何 A/CNAME 记录**（`dig +short hack.liutingqiu.xyz` 为空），可安全新建 |

### 1.4 认证方式（二选一，任选其一即可）

```bash
# 方式 A：API Token（推荐，无需浏览器）
export CLOUDFLARE_API_TOKEN="***"
export CLOUDFLARE_ACCOUNT_ID="***"

# 方式 B：OAuth（会打开浏览器授权页；注意不要动用户正在用的网易云 / x.com 标签页）
npx wrangler@4 login
npx wrangler@4 whoami          # 确认已登录、确认 account 正确
```

> `wrangler@4` 是显式主版本，避免 `@latest` 某天升到 v5 引入破坏性变更。
> 长期方案：把 `wrangler` 固定进 `web/package.json` 的 devDependencies（需开发部同意，本文件不代改）。

---

## 2. 构建

### 2.1 标准构建（与 CI 完全一致）

```bash
cd /home/liutingqiu/hackone
npm --prefix web ci          # 首次或依赖变动时；要求 package-lock.json 与 package.json 同步
npm --prefix web run build   # 实际执行 tsc -b && vite build
```

产物落在 `web/dist/`：

```
web/dist/index.html
web/dist/assets/index-<hash>.js
web/dist/assets/index-<hash>.css
```

### 2.2 构建通过判据（缺一不可）

1. 退出码 0（`tsc -b` 有类型错误会直接失败）；
2. `web/dist/index.html` 存在，且引用的是 `./assets/index-<hash>.*`；
3. 首屏 JS（gzip）< 150 KB —— CI 里有硬门槛，本地自查：
   ```bash
   find web/dist/assets -name '*.js' -exec cat {} + | gzip -c | wc -c
   ```

### 2.3 当前实测基线（2026-11-07 11:18 复现构建）

| 文件 | 原始 | gzip |
| --- | --- | --- |
| `assets/index-BzUSGYfH.js` | 151,806 B | 49,455 B |
| `assets/index-D2nnZDim.css` | 3,356 B | 1,282 B |
| `index.html` | 455 B | 330 B |

- `vite build` 耗时 **416 ms**，与开发部现有 `web/dist` **哈希完全一致**（可复现）；
- 首屏 JS gzip **49.5 KB / 150 KB 预算**，余量充足；
- `dist/` 被 `.gitignore` 忽略，**部署前必须现构建**，不能指望仓库里有产物。

### 2.4 静态托管兼容性结论（针对 `vite base: "./"`）

**结论：当前形态兼容，可以按现状部署到域名根路径；但不要加 SPA fallback，除非先把 base 改成 `"/"`。**

依据（已逐项核查 `web/dist` 与 `web/src`）：

| 检查项 | 现状 | 影响 |
| --- | --- | --- |
| `index.html` 资源引用 | `./assets/index-<hash>.js`、`./assets/index-<hash>.css` | 页面在 `/` 时解析为 `/assets/...`，正确 |
| 绝对路径引用（`"/assets/..."`） | 无 | 不会在子路径下 404 |
| 动态 `import()` / 分包 | 无（单 chunk） | 暂不涉及相对 base 的分包路径问题 |
| Web Worker / `new URL(...)` | 无（ADR-001 计划后续加） | 加 Worker 后需回归，Vite 会把 worker 资源发到同目录，通常仍正确 |
| 前端路由（history/pushState） | 无，单页单路由 | 没有深链接直接访问需求 |
| `index.html` 里的入口 | `/src/main.tsx`（构建时被 Vite 改写） | 构建产物已改写，无需处理 |
| CSS `url()` 外链 | 无 | 无字体/图片相对路径风险 |
| 未知路径 404 | Pages 默认返回 404 页 | 目前无影响 |

**风险点（写清楚，免得以后踩）**：

- 相对 base 只在「页面 URL 就是目录根」时成立。**一旦开启 SPA fallback**（`_redirects` 写 `/* /index.html 200`），访问 `/foo/bar` 会拿到 index.html，但 `./assets/...` 会解析成 `/foo/assets/...` → 白屏。
- 因此：**要么保持现状（无 fallback、无路由），要么把 `vite.config.ts` 的 `base` 改为 `"/"` 再加 fallback**。改 `vite.config.ts` 属开发部产物，需开发部执行 + 回归，运维不代改（已记入 §10 待办，报统筹）。
- 若后续加了 Web Worker：构建后检查 `dist/assets/` 里 worker 文件是否被 `./` 正确引用，用 `npx vite preview` 在根路径下点一次量化流程即可验证。

### 2.5 本地预览（部署前自检，不碰任何线上资源）

```bash
npm --prefix web run preview -- --port 4173
# 然后浏览器访问 http://127.0.0.1:4173/ ，确认：页面能开、控制台无 404、量化/分板可用
```

> `vite preview` 按 base 提供静态服务，行为最接近 Pages；比 `npm run dev` 更能暴露路径问题。

---

## 3. 首次部署（只在 YG 确认凭据后执行，且只做一次）

```bash
cd /home/liutingqiu/hackone

# 1) 确认凭据与账号
export CLOUDFLARE_API_TOKEN="***"
export CLOUDFLARE_ACCOUNT_ID="***"
npx wrangler@4 whoami

# 2) 建项目（仅首次；生产分支 main）
npx wrangler@4 pages project create hackone --production-branch=main

# 3) 构建（见 §2）
npm --prefix web ci
npm --prefix web run build

# 4) 上传
npx wrangler@4 pages deploy web/dist --project-name=hackone --branch=main
```

成功输出形如：

```
✨ Success! Uploaded 2 files (1.2 sec)
✨ Deployment complete! Take a peek over at https://<hash>.hackone.pages.dev
```

> `--branch=main` 必须显式给：CI 里 checkout 是 detached HEAD，不给 branch 会被当成 preview 部署，
> 生产域不会更新（这是最常见的「部署成功了但网站没变」原因）。
> 仓根有 `wrangler.toml` 时 `--project-name` / 目录都可省略，但显式写更抗歧义。

## 4. 日常部署（每次上线）

```bash
cd /home/liutingqiu/hackone
git switch main && git pull --ff-only        # 只从已合并的 main 部署
npm --prefix web ci                          # 依赖没变可跳过，但 CI 里始终执行
npm --prefix web run build
npx wrangler@4 pages deploy web/dist --project-name=hackone --branch=main
```

纪律：

- **只从 `main` 部署**；`feat/*` 分支要发 preview 时用 `--branch=<分支名>`，到 `<分支名>.hackone.pages.dev`，不影响生产域。
- 每次部署后**立刻**在 `journal/YYYY-MM-DD.log` 留一条：时间、commit、deployment URL、结果（格式见 §11）。
- 演示前 1 小时只允许「已演练过的同一条命令」，不做首次尝试。

---

## 5. 部署后验证清单（30 秒）

```bash
# 1) 默认域可达 + 拿到构建哈希
curl -sI https://hackone.pages.dev | head -3
curl -s https://hackone.pages.dev/ | grep -o 'assets/index-[a-zA-Z0-9_-]*\.js'

# 2) 自定义域可达（绑定后）
curl -sI https://hack.liutingqiu.xyz | head -3

# 3) 静态资源 200 + 正确 MIME（把上一步的哈希填进去）
curl -sI https://hack.liutingqiu.xyz/assets/index-<hash>.js | grep -iE 'HTTP/|content-type|cache-control'
```

逐项打勾：

- [ ] 线上 `index.html` 里的 JS 哈希 == 本地 `web/dist/index.html` 里的哈希（证明部署的是这次构建）
- [ ] JS 返回 `200` 且 `content-type: application/javascript`
- [ ] 页面在**手机 4G** 下能开（不只是本机 Wi-Fi）
- [ ] 控制台无 404、无 CORS、无 CSP 报错
- [ ] 上传图片 → 量化 → 分板 走通一次（冒烟）
- [ ] HTTPS 证书有效、无混合内容警告

---

## 6. 回滚

### 6.1 最快：Dashboard 一键回滚（推荐，10 秒）

Cloudflare Dashboard → Workers & Pages → **hackone** → **Deployments** → 找到上一个已知正常的 deployment → **Rollback to this deployment** → 确认。
生产域立即指回该版本；坏的那次部署记录保留，便于复盘。

### 6.2 API 回滚（无 GUI / 只有 token 时）

```bash
# 列出部署，取目标 deployment id
npx wrangler@4 pages deployment list --project-name=hackone

curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/hackone/deployments/<DEPLOYMENT_ID>/rollback" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.success'
```

### 6.3 从已知良好 commit 重新构建部署（最彻底）

```bash
git log --oneline -5                 # 找到可用的 commit
git switch --detach <good-sha>
npm --prefix web ci && npm --prefix web run build
npx wrangler@4 pages deploy web/dist --project-name=hackone --branch=main
git switch main
```

> Pages 的部署是不可变的静态快照，「回滚」= 把生产指向旧快照，不涉及数据库/迁移，风险低。
> 注意：回滚**不会**回滚 DNS 或自定义域设置；域名问题走 §9 排查。

### 6.4 演示兜底（域名/网络整体不可用）

1. 本机跑 `npm --prefix web run preview`，用**本地 IP/热点**演示；
2. 或直接用 `reference/perler-tool/` 的单文件 HTML 离线版（ADR-001 指定的兜底实现，功能以主版本为准）；
3. 演示前把上面两条都演练一遍，别在台上第一次试。

---

## 7. 域名绑定：`hack.liutingqiu.xyz`

### 7.0 现状（已核实，无需改）

```bash
dig +short liutingqiu.xyz NS
# elly.ns.cloudflare.com.
# ivan.ns.cloudflare.com.        → 域名已在 Cloudflare 托管，同账号绑 Pages 最顺
dig +short hack.liutingqiu.xyz   # 空 → 该子域没有任何记录，不会冲突
```

### 7.1 动手前先备份 DNS（ROLE 硬性要求：无备份不改 DNS）

```bash
# 用 token 导出整区记录，存到仓库外（不要提交）
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records?per_page=200" \
  > ~/hackone-dns-backup-$(date +%F-%H%M).json
wc -c ~/hackone-dns-backup-*.json
```

`ZONE_ID`：Dashboard → `liutingqiu.xyz` → 概览页右下角 **Zone ID**。

### 7.2 绑定步骤（同账号，Cloudflare 自动建记录）

1. Dashboard → Workers & Pages → **hackone** → **Custom domains** → **Set up a custom domain**；
2. 输入 `hack.liutingqiu.xyz` → **Continue**；
3. 确认自动生成的 CNAME 提示（`hack` → `hackone.pages.dev`，Proxy 开启）→ **Activate domain**；
4. 状态从 `Initializing` → **`Active`**（DNS 同区，通常秒级；证书签发一般 1–5 分钟，最长 24h）；
5. 若提示需要手动加记录，则到 DNS 页新增：
   - Type `CNAME`｜Name `hack`｜Target `hackone.pages.dev`｜Proxy **Proxied（橙色）**｜TTL Auto
   - **不要**再加 A/AAAA 指向其他主机，会和 CNAME 冲突（CNAME 与 A 不能同名共存）。

### 7.3 绑定后检查

```bash
dig +short hack.liutingqiu.xyz          # 应返回 Cloudflare 任意播 IP（104.x / 172.67.x）
curl -sI https://hack.liutingqiu.xyz | head -5
curl -s https://hack.liutingqiu.xyz/ | grep -o 'assets/index-[^"]*\.js'
# 证书链（有效期 / 颁发者）
echo | openssl s_client -connect hack.liutingqiu.xyz:443 -servername hack.liutingqiu.xyz 2>/dev/null | openssl x509 -noout -issuer -dates
```

### 7.4 SSL 设置（容易踩）

- 该 Zone 的 SSL/TLS 模式必须是 **Full** 或 **Full (strict)**；**Flexible 会导致 301 循环**。
- 建议开 **Always Use HTTPS**（Zone → SSL/TLS → Edge Certificates）。
- 若开了 HSTS，注意回滚/换域时浏览器会强制 HTTPS。
- 若域上有 CAA 记录，需允许 Cloudflare 的 CA，否则证书一直 `Pending`：
  ```bash
  dig +short CAA liutingqiu.xyz
  # 若有限制，需包含 0 issue "pki.goog" 与 0 issue "letsencrypt.org"
  ```

---

## 8. GitHub Actions 部署工作流（本轮只设计，**未启用**）

- 设计文档：[deploy-workflow.md](./deploy-workflow.md)
- 草稿文件：`.github/workflows/deploy.yml.disabled`（后缀不是 `.yml`/`.yaml`，GitHub **不会**执行）
- 启用前提：仓库已配好 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 两个 secret（Settings → Secrets and variables → Actions），
  且已经在 preview 分支上跑通过一次。
- 需要的 secret 只有这两个；`GITHUB_TOKEN` 由 Actions 自动提供（`deployments: write` 权限用于在 PR/Commit 上标记部署）。

---

## 9. 常见故障与处置

### 9.1 CI 排队（GitHub Actions `queued` 不动）

| 现象 | 判据 | 处置 |
| --- | --- | --- |
| 一直 `Queued` | `gh run list -L 5` 显示 queued > 3 分钟 | ① 取消重复 run（push 太快会堆好几个）：`gh run cancel <id>`；② 免费额度/并发用尽时等，或**改本地部署**（§4），不阻塞上线 |
| `Waiting for a runner` | runner 池满 | 同上；演示前 30 分钟不要指望 CI，一律本地预构建 |
| 多个 run 同时跑 | 同一分支连续 push | 加 `concurrency: {group: ci-${{ github.ref }}, cancel-in-progress: true}`（需改 ci.yml，属运维可改范围，见 §10） |

**兜底原则：CI 只是守门员，部署链路必须能手工走通。** 本地 `npm run build` + `wrangler pages deploy` 是最终保底。

### 9.2 构建失败

| 报错关键字 | 原因 | 处置 |
| --- | --- | --- |
| `error TS####` | 类型错误，`tsc -b` 直接失败 | 本地 `npm --prefix web run typecheck` 复现，交开发部修；**运维不改业务代码** |
| `npm ci ... lock file` / `EUSAGE` | `package-lock.json` 与 `package.json` 不同步 | 开发部本地 `npm install` 后提交 lock 文件，再部署 |
| `404 Not Found - GET ...` (npm) | npmmirror 同步滞后，新版本镜像还没有 | CI 里临时改用官方源：`npm_config_registry=https://registry.npmjs.org npm ci`；或降级到镜像已有版本 |
| `ETIMEDOUT` / `ECONNRESET` | 本机到 registry 慢（国内直连官方源 >160s 已实测） | 确认 `web/.npmrc` 生效、在 `web/` 目录下执行；不要删 .npmrc |
| `Cannot find module '@rollup/rollup-linux-x64-gnu'` | lock 里缺平台可选依赖（跨平台装包） | 删 `node_modules` 重装；CI 用 Linux 重装即可，勿提交 `node_modules` |
| 大小门槛失败 `超预算` | 首屏 JS gzip > 150 KB | 见 `docs/adr.md` ADR-001 预算；开发部分包/按需加载，运维不改阈值 |
| `vite: not found` / `sh: tsc: not found` | 没装依赖或在错误目录 | `npm --prefix web ci`；确认 `web/package.json` 存在 |
| 本地成功、CI 失败 | 大小写敏感 / 路径分隔符（Linux vs macOS） | 用与 import 完全一致的大小写；CI 看 `web/` 下真实文件名 |
| `heap out of memory` | 构建内存不足（少见） | `NODE_OPTIONS=--max-old-space-size=4096` 重试 |

> 排障顺序固定：**先在本地用与 CI 完全相同的命令复现** → 再看 CI 日志 → 再怀疑环境。

### 9.3 域名未生效

| 现象 | 排查 | 处置 |
| --- | --- | --- |
| `dig` 为空 | `dig +short hack.liutingqiu.xyz`；换 `dig @1.1.1.1` 排除本地 DNS 缓存 | 回 Dashboard 看 Custom domain 是否 `Active`；没记录就按 §7.2 补 CNAME |
| 解析到旧 IP | 记录类型/代理状态不对 | CNAME → `hackone.pages.dev` 且 Proxied；删掉同名 A/AAAA |
| 522 / 521 / 523 | Cloudflare 连不上源（Pages 侧异常） | 看 Pages 部署状态与 `.pages.dev` 是否正常；必要时回滚（§6） |
| 526 / 证书错误 | SSL 模式 Flexible，或证书没签下来 | 改 Full (strict)；查 CAA；等证书 `Active` |
| 301 无限跳转 | Flexible + Pages 强制 HTTPS | 改 Full (strict)，清浏览器缓存再试 |
| `Initializing` 超过 1 小时 | 证书 DCV 卡住 / CAA 限制 | 删掉该 custom domain 重新添加；检查 CAA；必要时先在 `.pages.dev` 演示 |
| 打开是 404 | 部署到了 preview 分支（缺 `--branch=main`），或输出目录传错 | `wrangler pages deployment list` 看环境；重新按 §4 部署 |
| 页面白屏、控制台 404 `/assets/...` | base 相对路径 + 深链接/SPA fallback | 见 §2.4；根路径访问应正常，深链接需改 base 为 `/` |
| 国内访问慢/间歇失败 | Cloudflare 免费版无中国节点，运营商线路波动 | 演示用「本地 preview / 离线单文件」兜底；提前在**演示场地网络**实测，不要只在本机测 |
| 改了 Dashboard 不生效 | 用了 `wrangler.toml` 后，Dashboard 相关字段变只读 | 改 `wrangler.toml` 并重新部署，不要两边改 |

---

## 10. 时间预算（实测/估算，供统筹排期）

| 环节 | 预计耗时 | 依据 |
| --- | --- | --- |
| `npm ci`（冷缓存，npmmirror） | 40–90 s | 依赖 138 个包，本机已装过 |
| `npm run build` | 1–2 s | 实测 vite 416 ms + tsc |
| 首次 `npx wrangler@4` 下载 | **1–5 min** | npmmirror，含 workerd 平台包；**装之前先问 YG** |
| `pages project create` | 5–10 s | 一次 API |
| `pages deploy`（3 文件 / ~155 KB） | 5–15 s | 上传量极小 |
| 自定义域生效（同区） | 1–5 min（多数 < 1 min） | DNS 即时 + 证书签发 |
| GitHub Actions 整条（含排队） | 2–5 min | 排队 0–2 min + 安装/构建/部署 |
| **首次端到端（含装 wrangler）** | **5–10 min** | 主要变量是 wrangler 下载 |
| **后续每次部署** | **1–2 min** | 构建秒级 + 上传十几秒 |

演示日建议：**提前至少 24h 完成首次部署与域名绑定**，留出证书与 DNS 的缓冲。

---

## 11. 部署记录格式（每次上线追加一条 journal）

```bash
./tools/journal.sh ops "部署 v<版本> 到生产" "commit <sha> · <deployment-url> · 冒烟通过"
```

留痕里必须能回答：**哪个 commit、什么时候、部署到哪、结果如何**（ROLE.md 完成定义）。

---

## 12. 待办与需要 YG / 统筹确认的事项

| # | 事项 | 归属 | 状态 |
| --- | --- | --- | --- |
| 1 | 提供 `CLOUDFLARE_API_TOKEN`（Pages Edit，首次加 DNS Edit）与 `CLOUDFLARE_ACCOUNT_ID` | YG | 待确认 |
| 2 | 是否允许本机安装 wrangler（`npx wrangler@4`，走 npmmirror，1–5 min） | YG | 待确认（本轮未装） |
| 3 | 是否把 `wrangler` 固定进 `web/package.json` devDependencies | 开发部 | 待评估（会影响 lock 与 CI 时间） |
| 4 | 是否把 `vite base` 改为 `"/"` 并加 SPA fallback | 开发部 | 暂不需要（当前无路由）；有深链接需求时再做 |
| 5 | 是否启用 `.github/workflows/deploy.yml.disabled` | 统筹 / YG | 待 secret 到位 |
| 6 | 给 ci.yml 加 `concurrency` 避免重复 run 排队 | 运维 | 可随时做（不改业务逻辑）；等统筹点头 |
| 7 | 演示前在场地网络实测 `hack.liutingqiu.xyz` | 运维 | 绑定后执行 |
