# orphan-override-maker

Slack の代講メッセージから `manual_orphan_overrides` を更新する補助ツールです。

## 動作概要

1. 入力文から `LMS edit URL` / `Notion URL` / 日時を抽出
2. `NOTION_WORKSPACE_HOST` と一致する Notion URL のみスクレイプ
3. `data/manual_orphan_overrides.json` を更新
4. `data/manual_orphan_lessons.json` を更新
5. orphan / substitute データを再生成

## 実行

```bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent
npm run orphan-override:from-input
```

## オプション

- `--dry-run`: 更新せずパースのみ
- `--skip-notion-scrape`: Notionスクレイプ無効
- `--no-build`: 再生成コマンドをスキップ

## 環境変数

- `NOTION_WORKSPACE_HOST` 例: `your-workspace.notion.site`
- `AUTO_PENDING_LESSON_URL` 例: `https://meet.google.com/your-room-code`
  - 未設定時は `manual_orphan_lessons.json` の `lessonUrl` を空で保存します。
