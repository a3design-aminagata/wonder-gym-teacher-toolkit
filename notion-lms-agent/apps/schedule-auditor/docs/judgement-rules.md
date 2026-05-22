# schedule-auditor

LMS（Wonder Gym 講師画面）に登録されている「確定スケジュール」と、  
`schedules_enriched.json` に含まれる予定データを突合し、  
**差分・不整合を検出するための監査ツール**です。

---

## 🎯 役割（入口）

- LMS 上の「確定済み授業」と JSON の一致確認
- 日付 / 時刻 / 地域 / 開講月 単位での突合
- 「JSON に無いが LMS にある」「LMS に無いが JSON にある」を検出

※  
このツールは **修正・更新は行わず、判定のみ**を責務とします。

---

## ▶ 実行方法

### ディレクトリ移動

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
```

### 監査実行（次の月を自動判定）

```bash
node apps/schedule-auditor/run.js --json data/schedules_enriched.json
```

### 月を明示指定する場合

```bash
node apps/schedule-auditor/run.js --year 2026 --month 1 --json data/schedules_enriched.json
```

---

## 📂 ディレクトリ構成

- apps/schedule-auditor/
  - run.js ：実行入口
  - README.md ：このファイル
  - docs/ ：仕様・思想・運用ドキュメント

---

## 🔗 関連ドキュメント

- [overview](./overview.md)  
  → このツールの位置づけ・思想

- [data-flow](./data-flow.md)  
  → LMS / JSON / Notion のデータの正

- [operations](./operations.md)  
  → 実行タイミング・運用ルール
