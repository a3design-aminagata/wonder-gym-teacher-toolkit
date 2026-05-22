#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# 1) Git追跡ファイル名: 機密ファイルをブロック
TRACKED_SENSITIVE_PATTERN='(^|/)(\.env|credentials\.json|token\.json|client_secret\.json)$'
if git ls-files | rg -n "$TRACKED_SENSITIVE_PATTERN" >/dev/null; then
  echo "[FAIL] Git追跡に機密ファイル名が含まれています。"
  git ls-files | rg "$TRACKED_SENSITIVE_PATTERN"
  exit 1
fi

# 2) Git追跡ファイル内容: 高信頼シークレットパターンをブロック
SECRET_PATTERN='(GOCSPX-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)'
if git grep -nI -E "$SECRET_PATTERN" -- .; then
  echo ""
  echo "[FAIL] Git追跡ファイル内にシークレットらしき文字列があります。"
  exit 1
fi

# 3) Git追跡ファイル内容: ローカル絶対パスをブロック
ABS_PATH_PATTERN='(/Users/[A-Za-z0-9._-]+/)'
if git grep -nI -E "$ABS_PATH_PATTERN" -- .; then
  echo ""
  echo "[FAIL] Git追跡ファイル内にローカル絶対パスがあります。"
  exit 1
fi

echo "[OK] safety-check を通過しました。"
