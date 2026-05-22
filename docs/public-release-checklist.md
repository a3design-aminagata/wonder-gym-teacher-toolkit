# 公開前チェック手順（Public化用）

この手順は「見せたくない情報を GitHub 公開で漏らさない」ための最小セットです。  
推奨は **既存リポジトリをそのまま Public にせず、公開専用リポジトリを新規作成** する方法です。

## 原則

1. 機密情報は `.gitignore` だけでは不十分（過去コミットに残るため）
2. 公開用はクリーンな初回コミットで作る
3. 既存リポジトリを Public にする場合は履歴精査が必須

## 推奨フロー（公開専用リポジトリを新規作成）

1. 共有元（このリポジトリ）は Private のまま維持する
2. 安全チェックを実行する

```bash
npm run safety:check
```

3. 公開用ディレクトリへ `.git` を除いてコピーする

```bash
mkdir -p ../wonder-gym-teacher-toolkit-public
rsync -a --delete \
  --exclude ".git/" \
  --exclude ".env" \
  --exclude "node_modules/" \
  ./ \
  ../wonder-gym-teacher-toolkit-public/
```

4. 公開用ディレクトリで Git 初期化して初回コミット

```bash
cd ../wonder-gym-teacher-toolkit-public
git init
git add .
git commit -m "chore: initial public release"
```

5. 公開用 GitHub リポジトリへ push（Public）

## 既存リポジトリを Public にする場合（非推奨）

すでに push 済み履歴に機密がある場合、最新版で削除しても履歴から見えます。  
この場合は次を実施します。

1. 露出したトークン/鍵を失効・ローテーション
2. `git filter-repo` 等で履歴から削除
3. 強制 push（`--force-with-lease`）

履歴書き換えは影響が大きいので、原則は新規公開リポジトリ方式を優先してください。

## 最終確認コマンド

```bash
# 公開設定確認（PRIVATE / PUBLIC）
gh repo view --json nameWithOwner,visibility,isPrivate

# 未コミット差分確認
git status --short

# 安全チェック
npm run safety:check
```
