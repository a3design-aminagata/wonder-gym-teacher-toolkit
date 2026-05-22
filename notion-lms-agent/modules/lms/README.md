# modules/lms

このディレクトリは、  
**`<LMS_BASE_URL>`（LMS）から必要な情報だけを取得・整形するためのモジュール群**です。

特に重要なのは：

- scrapeUserGroups.js
- 「保存先を呼び出し側が決める」設計
- 既存データを勝手に上書きしない安全思想

---

## 🎯 この modules/lms の責務

- LMS にログインする
- コース一覧ページを走査する
- user_group ID を取得する
- JSON にして返す／保存する

やらないこと：

- 可視化
- Slack 文言生成
- Notion データとのマージ
- 他ディレクトリの暗黙更新

---

## 📂 ディレクトリ構成

```text
modules/lms/
  ├─ loginLms.js
  ├─ attachLmsListUrl.js
  ├─ scrapeUserGroups.js
  └─ README.md
```

---

## 🧠 設計思想（重要）

### 1. 出力先は「呼び出し側が決める」

scrapeUserGroups.js は、

- デフォルトでは notion-lms-agent/data に出力
- 引数がある場合のみ、そのディレクトリに出力

apply-message-maker や visualizer_schedule を  
**勝手に上書きしない設計**になっている。

---

### 2. 安全なデフォルト挙動

```bash
node modules/lms/scrapeUserGroups.js
```

この実行で起きること：

```text
data/courses_with_group_ids.json が 1 つ更新されるだけ
```

他のツールには一切影響しない。

---

## ▶ 基本的な使い方

### デフォルト実行（安全）

```bash
node modules/lms/scrapeUserGroups.js
```

出力：

```text
data/courses_with_group_ids.json
```

---

### 出力先を指定する

```bash
node modules/lms/scrapeUserGroups.js apply-message-maker/data
```

出力：

```text
apply-message-maker/data/courses_with_group_ids.json
```

---

### 出力先 + ファイル名を指定

```bash
node modules/lms/scrapeUserGroups.js visualizer_schedule/data group_ids_v2.json
```

---

## 🔁 JS から API として使う

scrapeUserGroups.js は CLI 兼 API。

```js
import { scrapeUserGroupsTo } from "../modules/lms/scrapeUserGroups.js";

await scrapeUserGroupsTo(
  "apply-message-maker/data",
  "courses_with_group_ids.json"
);
```

---

## 📄 生成される JSON（概要）

```json
[
  {
    "courseKey": "07月東京マーケ",
    "month": 7,
    "area": "東京",
    "category": "マーケ",
    "lmsListUrl": "<LMS_BASE_URL>/lecturer-portal/...",
    "userGroupIds": ["225"]
  }
]
```

---

## 🔗 attachLmsListUrl.js との関係

- attachLmsListUrl.js  
  → コース情報に LMS 一覧 URL を付与
- scrapeUserGroups.js  
  → その URL から user_group ID を取得

役割を分離しているため、  
仕様変更時の影響範囲が限定される。

---

## ❌ このモジュールでやらないこと

- 他ディレクトリへの自動コピー
- JSON への追記マージ
- input.txt など文脈依存処理

それらは上位ツールの責務。

---

## ✨ この設計のメリット

- apply-message-maker / visualizer と完全分離
- データ汚染を防止
- 出所が明確
- 再利用・拡張が容易

---

## 🧭 位置づけまとめ

- LMS データ取得の唯一の正規ルート
- 副作用を極力持たない
- 何度実行しても安全

---
