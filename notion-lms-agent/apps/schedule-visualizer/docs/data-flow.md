# data-flow

このドキュメントは  
**「どのデータが正で、どう流れて、どこで加工されるか」** をまとめます。

---

## 1. 正データの置き場所

```text
notion-lms-agent/data/
```

このディレクトリ配下が **唯一の正データ**。

---

## 2. データ一覧と役割

### schedules.json / schedules_past.json

```text
取得元 : Notion
内容   : 授業日・時間・コース情報
役割   : すべての起点
```

---

### schedules_enriched.json

```text
生成元 : run_build_schedules_enriched.js
役割   : Notion + LMS URL を結合した中間データ
```

---

### lms_lessons_for_schedules.json

```text
取得元 : LMS スクレイプ
役割   :
- teacherStatus 判定
- editUrl 抽出
- 講師名取得
```

---

### manual_orphan_lessons.json

```text
入力元 : 手動（暫定振替）/ orphan-override-maker（自動暫定）
役割   :
- LMS 未登録の振替授業を orphan として先出し表示
- LMS 登録前の抜け漏れ防止
```

---

### manual_orphan_overrides.json

```text
入力元 : 手動（教材補完）
役割   :
- LMS 登録済み orphan へ教材リンクを後付け
- Notion 未スクレイプ時の pageUrl / materials 補完
```

---

## 3. 可視化用データ

### apps/schedule-visualizer/data.js

```text
生成元 : build_data_from_schedules.js
役割   :
- 表示に必要な最小構造
- mine / past / available に分類済み
```

このファイルは **生成物**。  
手編集しない。

### apps/schedule-visualizer/data/orphan_data.js

```text
生成元 : build_orphan_visualizer_data.js
入力   :
- data/lms_lessons_orphan.json
- data/manual_orphan_lessons.json
- data/manual_orphan_overrides.json
```

---

### apps/schedule-visualizer/data/substitute_data.js

```text
生成元 : build_substitute_data.js
入力   :
- data/manual_orphan_overrides.json
役割   :
- 交代対応（manual override）だけを一覧化したデータ
```

---

## 4. データフロー全体図

```text
Notion
  ↓
schedules.json
schedules_past.json
  ↓
schedules_enriched.json
  ↓
LMS scrape
  ↓
lms_lessons_for_schedules.json
  ↓
build_data_from_schedules.js
  ↓
apps/schedule-visualizer/data.js
  ↓
schedule_table.js
```

---

## 5. visualizer 側のスタンス

- data.js を **全面的に信頼**
- 不整合があれば「生成側」を直す
- 表示側でロジック補正しない

---

## 6. よくある勘違い

```text
✕ data.js が正データ
○ data/ 配下が正データ
```

data.js は「表示用キャッシュ」。

---

## 7. 追加データを扱いたくなったら

```text
① data/ に追加
② build_data_from_schedules.js で整形
③ schedule_table.js で表示
```

この順序を崩さない。
