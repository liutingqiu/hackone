# 部署 Runbook · hack.liutingqiu.xyz

> 适用版本：**v1.6 起**（零构建单文件架构）
> 产物：`product/index.html`（由 `app/build_html.py` 生成，约 448 KB）
> 上一篇针对 React 版 `web/` 的 runbook 已归档：[runbook-v1-react-archived.md](runbook-v1-react-archived.md)

---

## 0. 一页速查

```bash
cd /home/liutingqiu/hackone

python3 app/build_html.py                 # 构建产物
cp "app/拼豆图纸工具.html" product/index.html
node --test tests/runtime.test.cjs        # 回归（22 条）

npx wrangler pages deploy ./product --project-name hackone --branch main
```

短链 Worker 是**另一个项目**，单独部署（频率远低于前端）：

```bash
cd share && npx wrangler deploy
```

---

## 1. 架构提醒（最容易踩的坑）

| 东西 | 位置 | 部署方式 |
| --- | --- | --- |
| 前端单文件应用 | `product/index.html` | Pages，`pages deploy ./product` |
| 路演页 | `product/pitch/` | 同上，和前端一起上 |
| 短链服务 | `share/worker.js` | Worker，`cd share && wrangler deploy` |

**没有构建链**：`app/app_template.html` + `app/palettes.json` 由 Python 脚本拼装成单文件。
不要直接改 `product/index.html` —— 下次构建就覆盖了。

CI（`.github/workflows/ci.yml`）会比对产物与 `product/index.html` 是否一致，
所以**构建后必须把产物复制过去**，否则 CI 红。

---

## 2. 前置条件

### 2.1 wrangler

不需要全局安装，`npx wrangler@4` 即可。若 npx 卡在下载，指定镜像：

```bash
npm_config_registry=https://registry.npmmirror.com npx wrangler@4 --version
```

本机已有缓存的 wrangler 可直接用，例如
`~/.npm/_npx/0eedb5afd4158ff3/node_modules/.bin/wrangler`。

### 2.2 认证

```bash
npx wrangler whoami
```

能看到账号与 **Pages 写权限**即可。凭据在 `~/.wrangler/config`，**不要提交进仓库**。

---

## 3. 构建与自检

```bash
python3 app/build_html.py
cp "app/拼豆图纸工具.html" product/index.html
```

期望输出：

```
已生成 .../app/拼豆图纸工具.html
  大小 448.3 KB（其中色板数据 194.5 KB）
  品牌 9 个，色板合计 1751 色
```

### 3.1 通过判据（缺一不可）

1. `diff -q "app/拼豆图纸工具.html" product/index.html` 无输出；
2. `node --test tests/runtime.test.cjs` 全绿；
3. 浏览器打开 `product/index.html`（双击即可，不用服务器），控制台无报错，
   能导入一张图、出图纸、看到色号。

### 3.2 本地预览

单文件不需要起服务器，直接 `file://` 打开即可。短链分享在 `file://` 下会退回长链接，属正常。

---

## 4. 部署

```bash
npx wrangler pages deploy ./product --project-name hackone --branch main
```

- `--branch main` 对应生产分支；
- 输出会给 `https://<hash>.hackone.pages.dev` 预览地址与部署 id；
- 自定义域 `hack.liutingqiu.xyz` 跟随生产分支自动更新。

---

## 5. 部署后验证（30 秒）

```bash
curl -s https://hack.liutingqiu.xyz/ | wc -c      # 线上字节数
stat -c%s product/index.html                     # 本地字节数
```

**判据**：两个数字完全一致。

> 单文件没有资源哈希，字节数一致就说明部署的是这次构建。
> v1.5 → v1.6 的差值是 440,939 → 459,080，一眼能看出线上跑的是哪版。

再抽一个版本专属标记（v1.6 才有）：

```bash
curl -s https://hack.liutingqiu.xyz/ | grep -c "vq-box"
# 0 = 还是旧版；非 0 = v1.6 已生效
```

---

## 6. 回滚

### 6.1 Dashboard（推荐，最快）

Cloudflare Dashboard → Workers & Pages → `hackone` → Deployments →
选上一个正常部署 → Rollback。

### 6.2 从已知良好 commit 重建

```bash
cd /home/liutingqiu/hackone
git checkout <good-commit> -- app/ product/
python3 app/build_html.py
cp "app/拼豆图纸工具.html" product/index.html
npx wrangler pages deploy ./product --project-name hackone --branch main
git checkout HEAD -- app/ product/    # 还原工作区
```

### 6.3 演示兜底

域名或网络整体不可用时，直接用仓库里的 `product/index.html`（双击打开）。
功能与线上一致，只有短链分享需要联网。

---

## 7. 短链 Worker

只在改了 `share/worker.js` 时才需要：

```bash
cd share && npx wrangler deploy
```

KV 绑定与 `APP_URL` 在 `share/wrangler.toml` 里，
不要和仓库根的 `wrangler.toml`（Pages 用）混淆。

> 已知限制：`/api/get/:id` 无鉴权，知道 id 就能读。这是产品决策，不是缺陷。

---

## 8. 常见故障

| 现象 | 原因 | 处置 |
| --- | --- | --- |
| CI 报产物与 product/ 不一致 | 改了模板没重新构建，或没复制产物 | 跑 §3 的两步再提交 |
| wrangler 报未认证 | 凭据过期 | `npx wrangler login` 或重新配 token |
| npx 卡住不下包 | 默认 registry 慢 | 加 `npm_config_registry=https://registry.npmmirror.com` |
| 线上还是旧版 | 部署了错误目录 | 确认是 `./product` 不是 `./app`，用 §5 字节数核对 |
| 短链 404 | Worker 没部署或 KV 绑定缺失 | `cd share && npx wrangler deploy` |
| 页面白屏 | 单文件被截断 | 重新构建，确认以 `</html>` 结尾 |

---

## 9. 每次上线留痕

在 `journal/` 追加一行（格式见 `tools/journal.sh`）：

```
[HH:MM:SS] ops       部署 vX.Y 到 Pages    证据: 线上字节数 == 本地产物; 版本标记命中
```
