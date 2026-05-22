# apply-message-maker

未調整コマ（チャットワークに貼り付ける `[info]` ブロック）を解析し、  
**提出用メッセージ（message.txt）** と  
**スケジュール可視化（visualizer.html）** を自動生成するツールです。

あなたが触るのは **work ディレクトリだけ**。  
その他の処理は全部自動で動くように設計されています。

---

## 📁 ディレクトリ構成

```
apply-message-maker/
│
├── work/                    ← ★ あなたが触るのはここだけ
│   ├── input.txt            ← チャットワークの未調整コマを貼る
│   ├── message.txt          ← 自動生成（提出用メッセージ）
│   ├── removed.txt          ← 削除されたコマ一覧（理由付き）
│   ├── visualizer.html      ← スケジュール可視化ページ（ブラウザで開く）
│   └── main.py              ← ★ 一括実行スクリプト
│
├── core/                    ← 内部ロジック（触らない）
│   ├── parser.py                ← input.txt → available.json
│   ├── make_message.py          ← available.json → message/removed
│   ├── make_visualizer_data.py  ← スケジュール表用 data.js 生成
│   └── scrape_certified.py      ← 認定支部一覧を生成
│
├── data/                    ← 内部データ（触らない）
│   ├── available.json       ← parser の出力
│   ├── schedules.json       ← あなたの授業スケジュール（自動参照）
│   └── certified_list.txt   ← scrape_certified の出力
│
├── visualizer/              ← 可視化に利用される静的ファイル
│   ├── main.js
│   ├── style.css
│   └── data.js              ← make_visualizer_data.py の出力
│
└── README.md
```

---

## 🚀 使い方（基本ステップ）

### **1. work/input.txt にコマを貼る**

ChatWork の `[info]` ブロックをそのまま貼るだけ。

```
[info][title]■11/30(日) 未調整コマ一覧[/title]
9:00～
・【東京】2025年7月開講(6ヶ月) 4回目/20回目
[/info]
```

複数ブロック貼って OK。

---

### **2. 一括実行する**

```
cd notion-lms-agent
```

プロジェクトのルートで実行：

```
python3 apply-message-maker/work/main.py
```

実行内容：

1. **scrape_certified.py**  
   → Google シートから認定支部一覧を取得し  
   → `data/certified_list.txt` を生成

2. **parser.py**  
   → input.txt を解析して  
   → `data/available.json` を生成

3. **make_message.py**  
   → 得られたデータから  
   → `message.txt` と `removed.txt` を生成

4. **make_visualizer_data.py**  
   → 可視化用データ  
   → `visualizer/data.js` を生成

---

## 📄 出力されるファイル

| ファイル               | 内容                              |
| ---------------------- | --------------------------------- |
| **message.txt**        | Slack／提出用の整形済みメッセージ |
| **removed.txt**        | 削除されたコマ（理由付き）        |
| **available.json**     | 未調整コマを構造化したデータ      |
| **certified_list.txt** | 認定（マ・デ）一覧                |
| **data.js**            | visualizer 用データ               |

---

## 🧠 削除（除外）ルール

`make_message.py` 内で自動処理される。

| 条件                      | 説明                                 |
| ------------------------- | ------------------------------------ |
| **過去日**                | 今日より前の日付は削除               |
| **土日**                  | 土曜・日曜は削除                     |
| **18 時以降**             | 18:00 以降は削除                     |
| **自分の授業と被り**      | schedules.json と一致するコマは削除  |
| **自分の授業の 1 時間後** | 直後の時間帯も削除（移動確保のため） |

削除された内容はすべて **removed.txt** に：

```
2025-11-30 18:00【秋田】 → 理由: 18時以降
2025-12-01 11:00【大阪】 → 理由: 自分のスケジュールと被り
2025-12-01 12:00【大分】 → 理由: 自分の授業の1時間後
...
```

---

## 🎨 可視化（visualizer.html）

`work/visualizer.html` を開くと見られる。

機能：

- 時間軸 × 日付のスケジュール表
- **黒文字**：通常の未調整コマ
- **青文字**：あなたの授業（mine）
- **ピンク背景**：あなたの授業と被っている未調整コマ
- 表ヘッダに **曜日表示（祝日色対応：土 → 青、日 → 赤）**
- 時間帯は自動生成（最小〜最大を 1 時間刻みで）

視覚的に「どこが埋められるか」をすぐ確認できる。

---

## 🔧 補足

### あなたの授業スケジュール

`notion-lms-agent/data/` 内にある
`schedules.json` の内容に合わせて  
visualizer／message のどちらも自動調整される。
