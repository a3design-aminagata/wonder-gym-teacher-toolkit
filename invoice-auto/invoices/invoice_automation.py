# /path/to/wonder-gym-teacher-toolkit/invoice-auto/invoices/invoice_automation.py
import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

from config.settings import settings
from config.companies import COMPANIES

def download_invoice(company_key: str, keep_browser_open: bool = False) -> Path:
    """請求書をダウンロードし、保存したPathを返す"""
    config = COMPANIES.get(company_key)
    if not config:
        raise ValueError(f"設定が見つかりません: {company_key}")

    org_id = config["org_id"]
    
    # 日付計算
    today = datetime.date.today()
    target_month = today.month - 1 or 12
    target_year = today.year if today.month != 1 else today.year - 1

    url = (
        f"{settings.LMS_BASE_URL}/lecturer-portal/working-hours-input/organizations/"
        f"{org_id}/billing-amount?year={target_year}&month={target_month}"
    )
    # file_label を取得（未設定なら空文字）
    label = config.get("file_label", "")
    # ファイル名に label を差し込む
    filename = f"求職者支援訓練{label}＿{target_month}月度ご請求【{settings.NAME}】.pdf"
    save_path = settings.DOWNLOAD_DIR / filename

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False) # 動作確認のため一旦 headless=False
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        try:
            print(f"🌐 WL（{company_key}）にログイン中...")
            page.goto(url)

            page.wait_for_selector('input[type="email"]', timeout=15000)
            page.fill('input[type="email"]', settings.LOGIN_EMAIL)
            page.fill('input[type="password"]', settings.LOGIN_PASSWORD)
            page.click('button[type="submit"]')
            page.wait_for_load_state("networkidle")

            print("✅ ログイン完了、ダウンロード開始...")
            page.wait_for_selector('text=請求書DL', timeout=15000)
            
            with page.expect_download() as download_info:
                page.click('text=請求書DL')
            
            download = download_info.value
            download.save_as(save_path)
            print(f"💾 保存完了: {save_path}")
            print(f"🔗 請求書確認ページ: {url}")

            if keep_browser_open:
                print("👀 確認モード: 請求書内容を確認後、Enterで次へ進みます")
                try:
                    input("➡️ 確認が終わったら Enter を押してください: ")
                except EOFError:
                    print("⚠️ 標準入力が使えないため、確認待ちをスキップします")
        finally:
            browser.close()

    return save_path  # 保存したファイルのPathオブジェクトを返す

# 単体テスト用（python3 invoices/invoice_automation.py wl と叩けば単体でも動く）
if __name__ == "__main__":
    import sys
    cp = sys.argv[1] if len(sys.argv) > 1 else "wl"
    download_invoice(cp)
