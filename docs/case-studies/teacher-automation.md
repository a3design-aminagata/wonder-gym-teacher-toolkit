# Case Study: Teacher Workflow Automation

## Problem

講師業務で、同じ操作の繰り返し（LMS入力・Notion確認・監査）が多く、ヒューマンエラーと作業時間が増えていた。

## Solution

- Tampermonkey で UI 操作を短縮
- notion-lms-agent でデータ突合と可視化を自動化
- schedule-auditor で不整合を検知

## Technical Design

- Node.js + Playwright/Puppeteer でスクレイピングと整形
- Python で請求・Gmail 下書きワークフロー
- 共有版では機密情報を排除し、`.env` とローカルデータ生成で運用

## Reusability

- スクリプトをカテゴリ分割（LMS / Notion / Meet）
- 設定値を `.env` と `config` に分離
- 共有不可データを `.gitignore` で管理
