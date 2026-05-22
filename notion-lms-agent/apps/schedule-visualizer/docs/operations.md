# operations

このドキュメントは  
**「スケジュール可視化を最新状態に更新するために、何を実行すればいいか」**  
だけをまとめた運用メモです。

---

## 1. 通常の更新フロー（推奨）

### まとめて一括コマンド

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-updater/run_scrape_lms_lessons_for_schedules.js
node apps/schedule-visualizer/build_data_from_schedules.js
```

これにより：

- `data/lms_lessons_for_schedules.json` が更新
- `apps/schedule-visualizer/data.js` が再生成
- ▶ 表示に変わる

### ① Notion からスケジュール取得（未来・過去）

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
npm run update:schedules:notion
```

生成されるデータ：

```text
data/schedules.json
data/schedules_past.json
```

---

### ② schedules_enriched.json を生成

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-updater/run_build_schedules_enriched.js
```

生成されるデータ：

```text
data/schedules_enriched.json
```

---

### ③ LMS をスクレイプ（未登録 / ▶ / 別講師 判定）

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-updater/run_scrape_lms_lessons_for_schedules.js
```

生成されるデータ：

```text
data/lms_lessons_for_schedules.json
```

---

### ④ 可視化用データを再生成

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-visualizer/build_data_from_schedules.js
```

生成されるデータ：

```text
apps/schedule-visualizer/data.js
```

---

### ⑤ 画面を開く

```bash
open /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/index.html
```

---

## 2. 「▶ にしたいだけ」の最短更新

授業を LMS に登録したあと、  
**未登録 → ▶ に反映させたいだけ**の場合はこれだけで OK。

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-updater/run_scrape_lms_lessons_for_schedules.js
node apps/schedule-visualizer/build_data_from_schedules.js
```

---

## 3. LMS未登録の振替を先に表示したいとき（手動 orphan）

1. `data/manual_orphan_lessons.json` に行を追加
2. orphan データを再生成

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-visualizer/build_orphan_visualizer_data.js
```

これで `apps/schedule-visualizer/data/orphan_data.js` に反映される。

---

## 4. LMS登録済み orphan に教材/Notion を後付けしたいとき

Notion から拾えていない代講コマに対して、  
`data/manual_orphan_overrides.json` で教材リンクを上書きできる。

例:

```json
[
  {
    "editUrl": "<LMS_BASE_URL>/lecturer-portal/online-lesson-attendances/online_lessons/{LESSON_ID}/edit",
    "studentName": "生徒名",
    "pageUrl": "https://YOUR_NOTION_WORKSPACE.notion.site/4-13-3219b233781e80c2a729d47933989fdd",
    "materials": [
      {
        "text": "教材",
        "url": "https://docs.google.com/presentation/d/xxx/edit",
        "notionUrl": "https://YOUR_NOTION_WORKSPACE.notion.site/4-13-3219b233781e80c2a729d47933989fdd"
      }
    ]
  }
]
```

`editUrl` が一致した orphan 行に適用される（`studentName + scheduleKey` でも一致可）。

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-visualizer/build_orphan_visualizer_data.js
```

---

## 5. Slackメッセージから自動で追加したいとき（推奨）

`apps/schedule-visualizer/orphan-override-maker/work/input.txt` に  
代講依頼メッセージをそのまま貼って実行：

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
npm run orphan-override:from-input
```

この1コマンドで以下を実行します。

- LMS edit URL / Notion URL / 日時を抽出
- Notion URL が `https://YOUR_NOTION_WORKSPACE.notion.site/...` の場合のみ教材リンクをスクレイプ
- `data/manual_orphan_overrides.json` を追記/更新
- `data/manual_orphan_lessons.json` に「生徒未特定（自動）」の暫定行を追記/更新（同日時に手動確定行がある場合はスキップ）
- `apps/schedule-visualizer/build_orphan_visualizer_data.js` を実行
- `apps/schedule-visualizer/data/substitute_data.js` を再生成（交代対応一覧）
  - `substitute_data.js` は LMS 取り込み済み（`lms_lessons_for_schedules.json` / `lms_lessons_orphan.json` で `editUrl` 一致）を自動除外

検証だけしたいとき：

```bash
npm run orphan-override:dry-run
```

---

## 6. どのファイルが何を見ているか

```text
Notion
  ↓
data/schedules.json
data/schedules_past.json
  ↓
data/schedules_enriched.json
  ↓
LMS スクレイプ
  ↓
data/lms_lessons_for_schedules.json
  ↓
build_data_from_schedules.js
  ↓
apps/schedule-visualizer/data.js
  ↓
index.html + modules/common/visualizer/schedule_table.js
```

---

## 7. トラブル時のチェックポイント

- ▶ に変わらない  
  → run_scrape_lms_lessons_for_schedules.js を実行したか

- 未登録リンクが古い  
  → data/lms_lessons_for_schedules.json を再生成したか

- 表示がおかしい  
  → build_data_from_schedules.js と build_orphan_visualizer_data.js を実行したか
