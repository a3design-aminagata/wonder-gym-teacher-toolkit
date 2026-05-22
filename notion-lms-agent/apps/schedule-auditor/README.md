# schedule-auditor

Wonder Gym LMS（lecturer-portal）に登録されている  
**確定スケジュール** と  
`schedules_enriched.json`（Notion / ローカル集約データ）を突き合わせ、  
**差分・不整合を検出する監査ツール**です。

---

## 🎯 このツールの役割（入口）

- LMS 上の「確定スケジュール」を正とする
- JSON 側に
  - 登録漏れがないか
  - 余計なデータが混ざっていないか
- 日付・時間・エリア・開講月単位で突き合わせる

※ データ生成や修正は行いません  
※ **監査（検出）のみ**を責務とします

---

## ▶ 実行方法

### 1. プロジェクトルートへ移動（必須）

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
```

---

### 2. 監査を実行（基本）

#### 次の月を自動で監査（推奨）

```bash
node apps/schedule-auditor/run.js --json data/schedules_enriched.json
```

- 実行時点の「翌月」を自動判定します
- 月を考えて指定する必要はありません

---

#### 年月を明示して監査（手動指定）

```bash
node apps/schedule-auditor/run.js --year 2026 --month 1 --json data/schedules_enriched.json
```

---

## 📤 出力結果の見方（概要）

- missingInJson  
  → LMS には存在するが JSON に無い授業

- extraInJson  
  → JSON にはあるが LMS には存在しない授業

- status: OK  
  → 完全一致

- status: NG  
  → 差分または不正行あり

---

## 📁 データの正（Single Source of Truth）

- LMS（lecturer-portal）
- data/schedules_enriched.json

---

## 📚 詳細仕様・判定ルール

- 判定キーの定義
- 月の扱い（開講月）
- LMS / JSON の責務分離

👉 詳細は docs/ を参照

- ./docs/overview.md
- ./docs/judgement-rules.md
- ./docs/operations.md

---

## ⚠ 注意事項

- LMS にログイン可能な認証情報（.env）が必要です
- 本ツールはデータを変更しません
- 差分が出た場合は「どちらが正か」を必ず人間が判断してください
