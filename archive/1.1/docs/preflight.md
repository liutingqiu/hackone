# 前置条件配置表

> 生成时间：2026-11-07 10:45
> 图例：✅ 已完成 ｜ ⚠️ 部分可用 ｜ ❌ 未完成 ｜ 🔒 需外部条件

---

## A. 账号与仓库

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| A1 | 本地仓库 | ✅ | — | — | `git -C ~/hackone status` |
| A2 | 远端正库（私有） | ✅ liutingqiu/hackone | — | — | `gh repo view` |
| A3 | 队友权限 | ✅ sshanersshaner（write） | 让他接受邀请（已接受） | — | `gh api .../collaborators` |
| A4 | 队友代码 | ✅ 已推送（10:16，41960 行） | 按 ADR-005 移至 `reference/perler-tool/`，仅作参考实现 | — | `ls reference/` |
| A5 | 分支策略 | ⚠️ 约定有，未执行 | 开 `feat/*` 分支，跑一次 PR 流程 | 10min | 仓库出现 PR |
| A6 | main 分支保护 | ❌ 私有免费库不支持 | 转公开 或 放弃 | 5min | `gh api .../protection` |
| A7 | gh 登录与 scope | ✅ repo/gist/read:org/workflow | — | — | `gh auth status` |

## B. 开发环境

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| B1 | Node / npm | ✅ 22.23 / 10.9 | — | — | `node -v` |
| B2 | 依赖安装 | ✅ | — | — | `npm ci` |
| B3 | 构建 | ✅ | — | — | `npm run build` |
| B4 | 代码规范（ESLint/Prettier） | ❌ | 加配置 + 接进 CI | 40min | `npm run lint` |
| B5 | 单元测试（Vitest） | ❌ | 加框架 + 至少 1 个算法测试 | 60min | `npm test` |
| B6 | 环境变量管理 | ❌ 无 `.env` 机制 | 建 `.env.example`，约定不入库 | 15min | 文件存在 |

## C. 移动端（决定「网页+App 同步」能否成立）

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| C1 | 路线决策（PWA / Capacitor） | ❌ 未定 | **你拍板** | 10min | 写进 PLAN.md |
| C2 | PWA 基础（manifest + SW） | ❌ | 加配置、图标、缓存策略 | 2–3h | 平板「添加到主屏幕」 |
| C3 | Android SDK | ❌ 仅有空壳 `/usr/lib/android-sdk` | 装 platform + build-tools（3–4GB） | 60–90min | `sdkmanager --list` |
| C4 | JDK 版本 | ⚠️ Java 25（AGP 通常要 17/21） | 装 JDK 17 并设 `JAVA_HOME` | 20min | `java -version` |
| C5 | Gradle | ❌ 未安装 | 用 wrapper，无需全局装 | 10min | `./gradlew -v` |
| C6 | `ANDROID_HOME` | ❌ 未设置 | 写入 shell profile | 5min | `echo $ANDROID_HOME` |
| C7 | 真机调试 | ❌ 无 `~/.android` | 开 USB 调试，授权设备 | 15min | `adb devices` |
| C8 | 签名 keystore | ❌ 无 | 生成并保管（不入库） | 10min | `keytool -list` |
| C9 | iOS 打包 | 🔒 不可能 | 需 macOS + Xcode，本机是 Linux | — | — |

## D. 数据与素材

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| D1 | 色板数据 | ⚠️ 通用 56 色占位 | 找 MARD/COCO 公开色号表，确认授权 | 60min | 色板 JSON 含真实色号 |
| D2 | 字体授权 | ✅ 用系统字体 | 如需像素字体选 SIL OFL | — | 许可证文件 |
| D3 | 演示用图 | ❌ | 准备 3 张：简单卡通、照片、大图（>60×60） | 20min | 文件就位 |
| D4 | Logo / 图标 | ❌ | PWA 需要 192/512 图标 | 30min | manifest 可加载 |

## E. 流程与交付

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| E1 | CI（构建） | ✅ Actions 跑通 15s | — | — | `gh run list` |
| E2 | CI 接 lint/test | ❌ | 补步骤 | 20min | CI 日志含 lint/test |
| E3 | 部署链路 | ❌ | GitHub Pages 需要公开库或 Pro；否则用 Cloudflare Pages / Netlify | 40min | 公网 URL 可访问 |
| E4 | 版本标记 | ❌ | 提交 1.0.0 tag，便于回滚 | 5min | `git tag` |
| E5 | 演示兜底 | ❌ | 录 30 秒屏，防现场网络故障 | 20min | 视频文件 |

## F. 现场条件

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| F1 | 演示设备 | 🔒 未定 | 借平板 或 手机投屏 或 只用笔记本 | — | 设备在手 |
| F2 | 局域网访问 | ⚠️ dev server 在 192.168.0.3:5173 | 现场 WiFi 可能隔离客户端，备用手机热点 | 15min | 平板能打开页面 |
| F3 | 电源 | ⚠️ 现场插排问题 | 自带插排/充电宝 | — | — |
| F4 | 报名人数 | ⚠️ 系统要求 3 人 | 现场拼队 或 问主办方 | — | 报名成功 |

---


## G. 部署资源（本轮新增确认）

| # | 项 | 现状 | 需要做什么 | 预计 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| G1 | Cloudflare 账号 | ✅ 已登录（浏览器，Tianqi689@gmail.com） | — | — | 控制台可见 |
| G2 | 域名 | ✅ 子域名已定：`hack.liutingqiu.xyz` | 建 CNAME 指向 Pages | 5min | `dig` 生效 |
| G3 | CF Pages / Workers | ✅ 账号有权限 | 选部署方式：Pages 直传 或 Workers | 10min | 站点可访问 |
| G4 | 腾讯云服务器 | ✅ 可用（**信息待补**） | 提供 IP / SSH 用户 / 用途 | 10min | `ssh` 连上 |
| G5 | 部署方式决策 | ✅ 已定：Cloudflare Pages 静态站 | 腾讯云留待 V2（账号/云存储） | — | ADR-002 |

### G4 需要补充的信息

- 公网 IP、SSH 端口、登录方式（密钥 or 密码）
- 规格（几核几 G）、系统版本
- 是否已有 Nginx / Docker
- 是否已备案（国内服务器绑域名需要，纯 IP 访问不需要）

## 关键阻塞项（不解决就无法开工）

| 优先级 | 项 | 卡住什么 |
| --- | --- | --- |
| P0 | C1 路线决策 | 决定所有前端架构，不定就白写 |
| P0 | D1 色板数据 | 决定产品可信度（没有真实色号 = 玩具） |
| P1 | B4/B5 规范与测试 | 决定能不能两个人并行改代码 |
| P1 | E3 部署 | 决定有没有一个能给评委打开的链接 |
| P2 | C3–C8 Android | 只在选 Capacitor 时才需要，且耗时最长 |

---

## 建议的执行顺序（若今天 11:00 开始）

1. 拍板 C1 + D1 方向（20 分钟，你）
2. B4 + B5 打通（1.5 小时，我）
3. E3 部署出公网 URL（40 分钟，我）
4. C2 PWA 补全（2 小时，若选路线 A）
5. 其余按需