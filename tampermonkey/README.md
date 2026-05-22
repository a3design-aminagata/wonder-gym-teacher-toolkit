# Tampermonkey Scripts

講師業務でよく使う画面操作を短縮するユーザースクリプト集です。

## 先に読むドキュメント

- 導入手順（講師向け）: `../docs/teacher-quickstart-5min.md`
- 配布時の選別基準: `../docs/script-selection-matrix.md`

## 使い方

1. Chrome/Edge に Tampermonkey をインストール
2. Tampermonkey ダッシュボードを開く
3. 対象 `.user.js` ファイルを開いて内容を貼り付け、保存

## 主要カテゴリ

- `lms/` : LMS 操作補助
- `notion/` : Notion 操作補助
- `google-meet/` : Google Meet 補助
- `google-forms/`, `google-sheets/` : 入力補助

## 注意

- `@match` が限定的なスクリプトは、各自の環境に合わせてドメインを編集してください。
- API キーが必要なスクリプトは、Tampermonkey の `GM_setValue` でローカル保存してください。
- 本リポジトリにはキーやトークンをコミットしないでください。
- Notion 系スクリプトの正本は `tampermonkey/notion/*` です。
