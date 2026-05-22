# 共有スクリプト選別マトリクス

このドキュメントは、共有時の混乱を避けるためにスクリプトを 3 分類します。

- `共有OK`: そのまま配布しやすい
- `要設定`: 初期設定や実行知識が必要
- `除外`: 旧版・重複・個人依存が強く、配布対象にしない

## Tampermonkey の分類

### 共有OK（配布推奨）

- `tampermonkey/notion/notion-auto-loadmore.user.js`
- `tampermonkey/notion/notion-click-to-lms.user.js`
- `tampermonkey/notion/notion-favicon-reset.user.js`
- `tampermonkey/notion/notion-lms-group-linker.user.js`
- `tampermonkey/lms/common/nav.user.js`
- `tampermonkey/lms/common/title.user.js`
- `tampermonkey/lms/common/ui_textarea.js`
- `tampermonkey/lms/common/favicon-from-logo.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/bulk-select.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/buttons.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/date-checker.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/lesson-intro-template.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/shared-comment-sequential-fill.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/makeup-sheets-link.user.js`
- `tampermonkey/lms/usergroup-id-copy.user.js`
- `tampermonkey/lms/lecturer-portal/copy-courseid.user.js`
- `tampermonkey/google-sheets/google-sheets-jump-to-today.user.js`
- `tampermonkey/google-forms/google-forms-name-autofill.user.js`
- `tampermonkey/google-forms/google-forms-ai-prompt.user.js`
- `tampermonkey/google-meet/google-meet-end-call-confirm.user.js`
- `tampermonkey/google-meet/google-meet-hide-muted-warning.user.js`

### 要設定（初期設定が必要）

- `tampermonkey/lms/lecturer-portal/online_lessons/ai-comment.js` - Gemini API キー設定が必要。
- `tampermonkey/lms/lecturer-portal/online_lessons/lms-chatgpt-complete-bridge.user.js` - ChatGPT ワークフローと URL 設定が必要。
- `tampermonkey/lms/lecturer-portal/online_lessons/copy-studentnames.user.js` - 固定 ChatGPT スレッド URL と iOS ショートカット前提。
- `tampermonkey/google-meet/google-meet-gemini-prompt-helper.user.js` - Gemini 利用前提。
- `tampermonkey/google-sheets/google-sheets-jump-to-my-name.user.js` - 特定 Spreadsheet ID 固定。

### 除外（配布対象外）

- `tampermonkey/pinterest/pinterest-hide-annoying-ui.user.js` - 講師業務と無関係。

## notion-lms-agent の分類

### 共有OK（配布可能）

- `apps/schedule-auditor/` 一式
- `apps/schedule-updater/` 一式
- `apps/schedule-visualizer/` の可視化・ビルド本体

### 要設定（実行知識が必要）

- `apps/schedule-visualizer/orphan-override-maker/`
- `apps/slack-tools/assign-reply-maker/`
- `apps/gcal-sync/`
- `modules/lms/`, `modules/notion/` のスクレイピング実行系

### 除外（配布時は原則対象外）

- `apps/*/work/` に入る手入力運用ファイル
- `data/*.json` 実データ（共有版ではコミット禁止）
- デバッグ用スクリプト（`debug_*.js`, `*_debug.js`）

## 配布方針（公開版）

1. 配布対象は「共有OK」のみとする。  
2. 「要設定」は配布対象外（必要な場合のみ各自環境で設定して利用する）。  
3. 「除外」は配布しない。  
