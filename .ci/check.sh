#!/usr/bin/env bash
# 本地 CI：与 .github/workflows/ci.yml 做同样的事，零依赖，任何机器可跑。
# 用法：.ci/check.sh          跑全部
#       .ci/check.sh --fast   跳过安装，只跑构建/测试（日常用）
set -uo pipefail

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1
FAIL=0
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
bad()  { printf '  \033[31m✗ %s\033[0m\n' "$1"; FAIL=1; }

step "仓库结构"
for f in README.md docs/PLAN.md; do
  [ -f "$f" ] && ok "$f" || bad "缺少 $f"
done

step "环境"
ok "node $(node -v 2>/dev/null || echo '未安装')"
ok "npm $(npm -v 2>/dev/null || echo '未安装')"

if [ -f package.json ]; then
  if [ "$FAST" = 0 ]; then
    step "安装依赖"
    if [ -f package-lock.json ] || [ -f pnpm-lock.yaml ]; then
      npm ci >/dev/null 2>&1 && ok "npm ci" || bad "依赖安装失败"
    else
      npm install >/dev/null 2>&1 && ok "npm install" || bad "依赖安装失败"
    fi
  fi

  step "构建"
  npm run build --if-present >/tmp/ci-build.log 2>&1 && ok "build" || { bad "build 失败"; tail -20 /tmp/ci-build.log; }

  step "类型检查 / Lint"
  if grep -q '"typecheck"' package.json; then
    npm run typecheck >/tmp/ci-lint.log 2>&1 && ok "typecheck" || { bad "typecheck 失败"; tail -20 /tmp/ci-lint.log; }
  fi
  if grep -q '"lint"' package.json; then
    npm run lint >/tmp/ci-lint.log 2>&1 && ok "lint" || { bad "lint 失败"; tail -20 /tmp/ci-lint.log; }
  fi

  step "测试"
  if grep -q '"test"' package.json; then
    npm test -- --run >/tmp/ci-test.log 2>&1 || npm test >/tmp/ci-test.log 2>&1
    if [ $? -eq 0 ]; then ok "test"; else bad "test 失败"; tail -20 /tmp/ci-test.log; fi
  else
    ok "无测试脚本，跳过"
  fi
else
  ok "还没有 package.json，只检查文档"
fi

echo
if [ "$FAIL" = 0 ]; then
  printf '\033[32m全部通过\033[0m\n'
else
  printf '\033[31m有失败项，已阻止推送（可用 git push --no-verify 强行绕过）\033[0m\n'
fi
exit $FAIL
