# 📘 overview.md

Schedule Visualizer 全体設計・思想・位置づけ

---

## 🎯 この画面は何か

Schedule Visualizer は、

- 自分の全スケジュールを俯瞰するための画面
- 判断・確認を速くするためのダッシュボード
- 操作はしないが、次の行動を決めるための UI

である。

👉 つまり **編集ツールではなく「状況把握ツール」**。

---

## 🧠 設計思想（最重要）

この画面の設計は、以下の原則に基づく。

```text
正は LMS / Notion
Visualizer は結果を描画するだけ
```

### やらないこと

- 状態判定をしない
- ロジックを持たない
- API / scrape を直接呼ばない
- データを書き換えない

### やること

- 渡されたデータをそのまま描画
- 状態を視覚的に分かりやすく表現
- 次に押すべきリンクを提示

---

## 🧩 この画面の立ち位置

```text
Notion / LMS / Gmail
        ↓
     data/*.json
        ↓
   build_data_from_schedules.js
        ↓
   VISUALIZER_DATA
        ↓
   Schedule Visualizer（この画面）
```

- 上流で **すべて決着がついている**
- visualizer は **信じて描画するだけ**

---

## 🟦 役割分担

| レイヤ     | 責務                     |
| ---------- | ------------------------ |
| Notion     | 授業予定・教材リンクの正 |
| LMS        | 出欠・講師登録の正       |
| Scraper    | 正データを取得           |
| Builder    | 表示用データに変換       |
| Visualizer | 描画のみ                 |

---

## 📊 visualizer が扱うデータ

```js
const VISUALIZER_DATA = {
  mine: [...],       // 未来の自分の予定
  past: [...],       // 過去の予定
  available: []      // 予備（将来用）
};
```

- mine / past の分類は **生成側で決める**
- visualizer 側では日付判定をしない

---

## 🟨 LMS 状態表示の考え方

visualizer では、以下のように **結果だけを表示**する。

| 状態         | 表示       |
| ------------ | ---------- |
| 講師未登録   | 未登録     |
| 自分が講師   | ▶          |
| 他講師が登録 | 講師名 + ▶ |

判定ロジックは **すべて生成側**。

---

## 🧭 なぜこの設計か

### 理由 ① 壊れにくい

- visualizer を触っても scrape は壊れない
- scrape を変えても UI は壊れにくい

### 理由 ② 思考コストが低い

- どこを直すかが明確
- 表示バグとデータバグを切り分けられる

### 理由 ③ 将来拡張しやすい

- Slack / 自動通知 / CSV 出力に流用可能
- visualizer を別 UI に差し替えても同じ data.js が使える

---

## ❌ やってはいけないこと

- visualizer 内で status を計算する
- schedule_table.js をコピーする
- data.js を手で編集する
- Notion / LMS の仕様をここに埋め込む

---

## ✅ この画面のゴール

- 開けば今日〜数ヶ月先まで一瞬で把握できる
- 未登録コマが即わかる
- 次に押すべきリンクが迷わず見える

それ以上のことはしない。

---

## 🔗 関連ドキュメント

- docs/operations.md  
  → いつ何を実行すれば状態が変わるか

- docs/data-flow.md  
  → data/\*.json の正と流れ

- docs/lms-status.md  
  → 未登録 / ▶ / 別講師 の判定定義
