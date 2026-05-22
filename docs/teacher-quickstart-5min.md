# 講師向け 5 分導入ガイド

このガイドは、講師が最短で使い始めるための手順です。  
対象は `Tampermonkey` の `共有OK` スクリプトのみです。

## 0. 事前準備（1分）

1. Chrome または Edge を用意
2. Tampermonkey をインストール
3. ブラウザで LMS / Notion にログインしておく

## 1. スクリプトを入れる（3分）

### 優先セット（まず入れる）

- `tampermonkey/lms/lecturer-portal/online_lessons/bulk-select.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/buttons.user.js`
- `tampermonkey/lms/lecturer-portal/online_lessons/date-checker.user.js`
- `tampermonkey/notion/notion-auto-loadmore.user.js`
- `tampermonkey/notion/notion-click-to-lms.user.js`
- `tampermonkey/notion/notion-lms-group-linker.user.js`

### 追加セット（必要なら）

- `tampermonkey/lms/common/nav.user.js`
- `tampermonkey/lms/common/title.user.js`
- `tampermonkey/lms/common/ui_textarea.js`
- `tampermonkey/google-meet/google-meet-end-call-confirm.user.js`
- `tampermonkey/google-meet/google-meet-hide-muted-warning.user.js`

## 2. 動作確認（1分）

1. LMS の出欠編集ページを開く
2. 「参加」「不参加」などの追加ボタンが表示されるか確認
3. Notion で「さらに読み込む」が自動実行されるか確認

## 3. つまずいたとき

1. Tampermonkey の該当スクリプトが `Enabled` か確認
2. `@match` 対象 URL に今の画面 URL が一致しているか確認
3. 同機能の重複スクリプトを入れていないか確認

## 配布担当向けメモ

- 配布は `docs/script-selection-matrix.md` の `共有OK` から開始する
- `社内限定` スクリプトは個別サポート前提で配布する
- 実データ・認証情報は絶対にコミットしない
