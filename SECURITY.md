# セキュリティ方針

## コミット禁止項目

- APIキー、OAuthトークン、認証情報JSON
- LMS / Notion / Slack 由来の個人情報
- 個人や環境を特定できるローカル絶対パス

## プッシュ前チェックリスト

1. `git diff` に認証情報が含まれていない
2. `rg -n "(client_secret|token.json|credentials.json|API_KEY|PASSWORD)"` で機密ファイル候補が検出されない
3. `data/` や `work/` に実データが残っていない

## 漏えい時の対応

1. すぐに公開停止（非公開化、公開範囲の遮断）
2. トークン・鍵をローテーション
3. 履歴から削除（`git filter-repo` など）
