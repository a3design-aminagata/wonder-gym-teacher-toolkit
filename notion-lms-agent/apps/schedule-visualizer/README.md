# schedule-visualizer

Notion / LMS のスケジュールを  
**横断的に確認するための可視化ダッシュボード**です。

- 日付を埋めた横スクロール型テーブル
- 月ヘッダー固定 + スクロール中の月表示
- LMS の「未登録 / ▶ / 別講師」を即確認・即クリック

👉 表生成ロジック・CSS は  
`modules/common/visualizer/` を **全面的に利用**します。

---

## 🚀 クイックスタート（普段はこれだけ）

### スケジュール〜LMS 突合〜可視化を一括更新

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
npm run update:schedules:all
```

### 画面を開く

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer
open index.html
```

---

## 📂 ディレクトリ構成

```text
apps/schedule-visualizer/
  ├─ index.html        ← 表示用（ロジックなし）
  ├─ data.js           ← 可視化データ（生成物）
  ├─ style.css         ← 画面固有の最小 CSS
  ├─ README.md         ← 入口（このファイル）
  └─ docs/             ← 詳細ドキュメント
```

---

## 📘 詳細ドキュメント（クリックで即参照）

- [docs/overview.md](./docs/overview.md)  
  → この画面の思想・位置づけ・責務

- [docs/operations.md](./docs/operations.md)  
  → 「いつ」「何を実行すると」▶ になるか

- [docs/data-flow.md](./docs/data-flow.md)  
  → data/\*.json の流れと正データ

- [docs/lms-status.md](./docs/lms-status.md)  
  → 未登録 / ▶ / 別講師 の判定ルール

- [orphan-override-maker/README.md](./orphan-override-maker/README.md)  
  → Slack代講メッセージから `manual_orphan_overrides.json` を自動更新

---

## ❌ README に書かないこと

- 実装詳細
- 判定ロジック
- データ仕様

👉 それらは **docs/** に集約する
