# lms-status

このドキュメントは、可視化画面に出る **LMS ステータス（未登録 / ▶ / 別講師名表示）** の意味と、どのデータから作られているかをまとめたものです。

---

## 1. 何がデータソースか（結論）

表示に必要な主な入力はこの 2 つです。

```text
data/schedules_enriched.json
data/lms_lessons_for_schedules.json
```

````

そこから `build_data_from_schedules.js` が `apps/schedule-visualizer/data.js` を生成し、
`modules/common/visualizer/schedule_table.js` が描画します。

---

## 2. 用語：scheduleKey

Notion 側の「日付 + 開始時刻」をキー化したもの。

```text
scheduleKey = "YYYY-MM-DDTHH:MM"
例: 2025-12-19T09:00
````

これで Notion と LMS の突合をします。

---

## 3. teacherStatus の種類（概念）

`data/lms_lessons_for_schedules.json` の各 schedule に `teacherStatus` が入ります。

### matched

- LMS 上の講師名が **自分（.env の NAME）と一致**
- 画面上は **▶**（editUrl に飛べる導線）

### missing

- LMS の該当日時に行はあるが、講師名が **空欄**
- 画面上は **未登録**（editUrl に飛べる導線）

### different

- LMS の該当日時に別の講師名が入っている
- 画面上は **別講師名を表示**（＋ ▶ で editUrl に飛べる）

### no_row

- LMS テーブルに「その日時の行」が見つからない
- 画面上は基本 **未登録扱い**にしてよい（editUrl が拾えない場合がある）

### unknown

- 何らかの理由で判定できない
- 画面は **▶ を残す**か **何も出さない**のどちらかで運用

---

## 4. 「未登録」「▶」が飛ぶ URL は何か

可視化でクリックさせたいのは user_groups の一覧ではなく、  
**該当授業の edit ページ**です。

```text
<LMS_BASE_URL>/lecturer-portal/online-lesson-attendances/online_lessons/{LESSON_ID}/edit
例: <LMS_BASE_URL>/lecturer-portal/online-lesson-attendances/online_lessons/{LESSON_ID}/edit
```

この URL は `data/lms_lessons_for_schedules.json` 内の `matchedLessons[].editUrl` から抽出されます。

---

## 5. 画面側で使うフィールド（data.js に載せるもの）

`apps/schedule-visualizer/data.js` の item に、最低これがあると運用できます。

```js
{
  scheduleKey: "2025-12-19T09:00",
  lmsUrl: "https://.../user_groups/223?number_of_times=24",
  teacherStatus: "missing",
  editUrls: ["https://.../online_lessons/{LESSON_ID}/edit"],
  teacherNames: ["山田太郎"] // different のとき表示したい
}
```

---

## 6. 表示ルール（推奨）

- `teacherStatus === "missing"` → 「未登録」リンク（editUrl へ）
- `teacherStatus === "matched"` → 「▶」リンク（editUrl へ）
- `teacherStatus === "different"` → 「別講師名」＋「▶」リンク（editUrl へ）
- `editUrls が空` → 何もリンクを出さない（拾えてない）

※ `badge` は出さない方針なら常に空で OK。

---

## 7. 更新手順（▶ に反映したいとき）

授業を登録したあと、表示を最新にする最低限の更新手順：

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
node apps/schedule-updater/run_scrape_lms_lessons_for_schedules.js
node apps/schedule-visualizer/build_data_from_schedules.js
```

---

## 8. よくある落とし穴

- `.env の NAME が空`  
  → teacherStatus 判定が弱くなる（matched / different が崩れる）

- login がタイムアウトする  
  → `modules/lms/auth/loginLms.js` の待ち条件を `networkidle2` に依存しない方式にする（現在の方式が推奨）

- editUrl が拾えない  
  → LMS 側テーブル構造が変わった可能性があるため、`extractLmsRows()` の selector を見直す

```

```
