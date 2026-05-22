# schedule-updater

Notion / LMS スケジュール更新の「入口」アプリ（実行フロー定義）。

## 責務
- modules の処理を、実行ユースケースとして束ねる（入口）
- data/ の canonical データを更新するための実行を提供する

## 非責務
- 実行日・実行時刻の制御（runner/run_daily.py + launchd 側）
- 可視化UI（visualizer_schedule）
- 未調整コマ解析（apply-message-maker）

## コマンド

~~~bash
cd /path/to/wonder-gym-teacher-toolkit/notion-lms-agent

# light 取得（detail無し、軽量）
npm run build:schedules:light

# light を見て「必要な時だけ」重い更新を走らせる
npm run update:schedules:auto
~~~

## 出力
- data/schedules_light.json
- data/schedules_light_state.json
