# notion-lms-agent

Notion と LMS のスケジュール情報を扱う自動化スクリプト群です。

## できること

- Notion スケジュールの取得
- LMS 情報との突合
- 可視化データの生成
- 差分監査（schedule-auditor）

## セットアップ

```bash
cd notion-lms-agent
npm install
```

親ディレクトリの `.env` を利用します（`modules/common/loadEnv.js` で上位探索）。

必須例:

```env
LOGIN_EMAIL=your@email.address
LOGIN_PASSWORD=your_password
NAME=your_name
NOTION_SCHEDULE_URL=https://www.notion.so/your_workspace/your_view_id
NOTION_BASE_URL=https://YOUR_NOTION_WORKSPACE.notion.site
```

任意（orphan-override-maker で暫定授業URLを自動付与する場合）:

```env
AUTO_PENDING_LESSON_URL=https://meet.google.com/your-room-code
```

## よく使う実行例

```bash
# 監査
node apps/schedule-auditor/run.js --json data/schedules_enriched.json

# 可視化ビルド
node apps/schedule-visualizer/build_data_from_schedules.js
```

## データについて

この共有版では `data/` 配下の実データは同梱していません。  
実運用データはローカルで生成し、コミットしないでください。
