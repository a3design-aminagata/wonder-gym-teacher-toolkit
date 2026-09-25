# wonder-gym-teacher-toolkit プロジェクト指示

## クラウドセッション（iPhone / claude.ai/code）は main に push する

- **`claude/...` などのブランチで始まっても、作業前に `git checkout main && git pull --ff-only origin main` して main で作業し、main へ push する**（2026-09-25 ユーザー指定）。ブランチへの push だけでは本番に出ず、ユーザーが後で merge する手間になる
- push が non-fast-forward で拒否されたら `git pull --rebase origin main` してから push し直す。force push はしない
