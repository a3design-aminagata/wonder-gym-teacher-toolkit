# invoice-auto

請求書ダウンロードと Gmail 下書き作成を自動化する Python スクリプトです。

## セットアップ

```bash
cd invoice-auto
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 実行

```bash
python main.py all --no-review
```

## 認証情報

`invoice-auto/credentials/` 配下に OAuth ファイルを配置して実行します。

- `credentials.json`
- `token.json`

これらは `.gitignore` 済みです。コミットしないでください。

## 会社設定

送信先や組織IDは `config/companies.py` のサンプルを各環境向けに編集してください。
