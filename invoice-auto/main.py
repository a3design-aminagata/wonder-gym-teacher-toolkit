# /path/to/wonder-gym-teacher-toolkit/invoice-auto/main.py
import argparse
import sys
from config.companies import COMPANIES
from invoices.invoice_automation import download_invoice
from invoices.invoice_gmail import create_gmail_draft

def execute_pipeline(company_key: str, keep_browser_open: bool):
    """ダウンロードから下書き作成までの一連の流れを実行"""
    print(f"\n" + "="*50)
    print(f"🚀 {company_key.upper()} 処理開始")
    print("="*50)
    
    try:
        # 1. ダウンロードしてファイルパスを取得
        pdf_path = download_invoice(company_key, keep_browser_open=keep_browser_open)
        
        # 2. 取得したパスを使ってGmail下書き作成
        create_gmail_draft(company_key, pdf_path)
        
        print(f"\n✨ {company_key.upper()} の全工程が正常に完了しました")
        
    except Exception as e:
        print(f"\n❌ {company_key.upper()} でエラーが発生しました:")
        print(f"   エラー内容: {e}")

def parse_args():
    parser = argparse.ArgumentParser(
        description="請求書PDFダウンロードとGmail下書き作成を実行します。"
    )
    parser.add_argument(
        "target",
        nargs="?",
        default="all",
        help=f"対象会社（all, {', '.join(COMPANIES.keys())}）",
    )
    review_group = parser.add_mutually_exclusive_group()
    review_group.add_argument(
        "--review",
        action="store_true",
        help="ダウンロード後に確認のためブラウザを開いたまま待機します。",
    )
    review_group.add_argument(
        "--no-review",
        action="store_true",
        help="ダウンロード後に確認待ちせず自動で次の処理へ進みます。",
    )
    return parser.parse_args()

def main():
    args = parse_args()

    target = args.target.lower()
    if args.target == "all" and len(sys.argv) < 2:
        print("💡 引数なし：全社(all)を処理します")

    if target == "all":
        targets = list(COMPANIES.keys())
    elif target in COMPANIES:
        targets = [target]
    else:
        print(f"❌ 不明なターゲット: {target}")
        print(f"有効な値: all, {', '.join(COMPANIES.keys())}")
        return

    is_interactive = sys.stdin.isatty() and sys.stdout.isatty()
    keep_browser_open = (args.review or is_interactive) and not args.no_review
    if keep_browser_open:
        print("👀 確認モード: 請求書ダウンロード後、Enter入力までブラウザを開いたままにします")
    else:
        print("⚙️ 自動モード: 請求書ダウンロード後はブラウザを自動で閉じます")

    for cp in targets:
        execute_pipeline(cp, keep_browser_open=keep_browser_open)

if __name__ == "__main__":
    main()
