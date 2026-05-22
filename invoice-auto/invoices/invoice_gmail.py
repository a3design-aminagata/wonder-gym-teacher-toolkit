# /path/to/wonder-gym-teacher-toolkit/invoice-auto/invoices/invoice_gmail.py
import os
import base64
import datetime
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from config.settings import settings
from config.companies import COMPANIES

def get_gmail_service():
    creds = None
    if settings.GMAIL_TOKEN.exists():
        creds = Credentials.from_authorized_user_file(str(settings.GMAIL_TOKEN), settings.SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(settings.GMAIL_CREDENTIALS), settings.SCOPES)
            creds = flow.run_local_server(port=0)
        with open(settings.GMAIL_TOKEN, "w") as token:
            token.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)

def create_gmail_draft(company_key: str, pdf_path: Path):
    """指定されたファイルを添付してGmail下書きを作成する"""
    config = COMPANIES.get(company_key)
    if not config:
        print(f"⚠️ 設定が見つかりません: {company_key}")
        return

    if not pdf_path.exists():
        print(f"⚠️ ファイルが見つかりません: {pdf_path}")
        return

    service = get_gmail_service()
    
    # メール内容構築
    month = (datetime.date.today().month - 1) or 12
    subject = f"{month}月度ご請求【{settings.NAME}】"
    body = f"""{config['company_name']}
ご担当者様

お世話になっております。
{settings.NAME}です。

{month}月分の請求書を添付いたします。
よろしくお願いいたします。
"""

    msg = MIMEMultipart()
    msg["to"] = config["send_to"]
    msg["subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with open(pdf_path, "rb") as f:
        part = MIMEApplication(f.read(), _subtype="pdf")
    part.add_header("Content-Disposition", "attachment", filename=pdf_path.name)
    msg.attach(part)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().drafts().create(userId="me", body={"message": {"raw": raw}}).execute()
    print(f"✉️ Gmail下書き作成完了（宛先: {config['send_to']}）")

# 単体テスト用
if __name__ == "__main__":
    import sys
    cp = sys.argv[1] if len(sys.argv) > 1 else "wl"
    # テスト用でも config の file_label を考慮したパスを作る
    label = COMPANIES.get(cp, {}).get("file_label", "")
    month = (datetime.date.today().month - 1) or 12
    test_file = settings.DOWNLOAD_DIR / f"求職者支援訓練{label}＿{month}月度ご請求【{settings.NAME}】.pdf"
    create_gmail_draft(cp, test_file)