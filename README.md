# Wonder Gym Teacher Toolkit

講師業務の反復作業を減らすためのツール集です。  
このリポジトリは **共有可能な範囲に限定** した版で、実運用データや認証情報は含みません。

## このリポジトリの目的

- LMS / Notion 周辺の操作を講師間で再利用できる形にする
- 自動化の実装例を公開し、改善しやすい土台を作る
- 実運用に近い設計・実装の再利用例を示す

## 構成

- `tampermonkey/` : ブラウザユーザースクリプト集
- `notion-lms-agent/` : スケジュール集約・可視化・監査のスクリプト群
- `invoice-auto/` : 請求書処理の自動化サンプル
- `.env.example` : 設定値テンプレート

## セットアップ

```bash
git clone <your-repo-url>
cd wonder-gym-teacher-toolkit
cp .env.example .env
```

必要に応じて以下も実行してください。

```bash
cd notion-lms-agent && npm install
cd ../invoice-auto && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

## 共有版ポリシー

このリポジトリでは、次を **コミット禁止** とします。

- 認証情報（`token.json`, `credentials.json`, `client_secret.json` など）
- 個人情報を含む実データ（スケジュールJSON、作業ログ、Slack入力履歴など）
- ローカル環境に依存する絶対パス

詳細は `SECURITY.md` を参照してください。

## すぐ使う入口

- Tampermonkey を使う: `tampermonkey/README.md`
- 講師向け 5 分導入: `docs/teacher-quickstart-5min.md`
- 共有スクリプト選別表: `docs/script-selection-matrix.md`
- 公開前チェック手順: `docs/public-release-checklist.md`
- スケジュール監査を試す: `notion-lms-agent/apps/schedule-auditor/README.md`
- 請求自動化の流れを見る: `invoice-auto/README.md`
- 事例概要: `docs/case-studies/teacher-automation.md`

## ライセンス

MIT
