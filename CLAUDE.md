# wonder-gym-teacher-toolkit プロジェクト指示

## ブランチ運用（PC・iPhone のどのセッションも共通）

2026-09-25 ユーザー指定。**main に直接コミットしない。毎回ブランチで作業し、確認が通ったらユーザーに聞かずに自分で main へ入れて push する。** 公開リポジトリなので、ブランチへの push でも Safety Check（秘密情報の混入チェック）が走る。これは意図どおり。

1. 開始時に `git fetch origin` で最新の main を取る
2. 作業ブランチを切る: `git switch -c <内容が分かる名前> origin/main`
   - クラウドセッション（iPhone / claude.ai/code）で最初から付いている `claude/...` ブランチ、PC でアプリが作った worktree のブランチは、そのまま使ってよい
   - **PC の本体フォルダ（`~/WL/wonder-gym-teacher-toolkit`）は main のまま置いておき、そこでブランチを切り替えない**（他のセッションが同じフォルダを使っているため）。PC で本体フォルダから始まったセッションは `git worktree add .claude/worktrees/<名前> -b <名前> origin/main` で worktree を作ってそこで作業する
3. 修正して「merge 前の確認」を通す: `npm run safety:check` が通ること
4. 最新の main を取り込む: `git fetch origin && git merge origin/main`
5. conflict は自分で解消する（両方の意図を残す。どちらを取るか判断できない時だけユーザーに聞く）。解消したら 3 の確認をもう一度
6. main へ入れる: `git push origin HEAD:main`（4 で取り込み済みなので fast-forward で入る）。**拒否されたら（他のセッションが先に入れた）4 からやり直す**
7. PC では本体フォルダの main も進めておく: `git -C ~/WL/wonder-gym-teacher-toolkit merge --ff-only origin/main`（本体フォルダに未コミットの変更がある時は触らない。次のセッション開始時に同期フックが追いつかせる）
8. **force push 禁止。** 入れ終わったらブランチを消す（ローカル・リモート・worktree。クラウドからはリモートを消せないのでローカルだけ）
- **例外: ユーザーが「見てから決めたい」「どっちか選びたい」と言った変更**は 6 の前で止め、スクリーンショット等を見せて OK をもらってから入れる
- GitHub の PR は作らない（Actions の分数を使い、手間が増えるだけ）
