import os
from pathlib import Path
from dotenv import load_dotenv

# プロジェクトのルートディレクトリを取得 (invoice-auto/)
BASE_DIR = Path(__file__).resolve().parent.parent

# 共通の.envを読み込み（親ディレクトリにある場合も考慮）
load_dotenv(BASE_DIR.parent / ".env") # 元々の場所
load_dotenv(BASE_DIR / ".env")        # invoice-auto直下にある場合

def require_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise RuntimeError(f"{name} が未設定です。.env に設定してください。")
    return value

class Settings:
    NAME = os.getenv("NAME")
    LOGIN_EMAIL = os.getenv("LOGIN_EMAIL")
    LOGIN_PASSWORD = os.getenv("LOGIN_PASSWORD")
    DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "~/Downloads")).expanduser()
    LMS_BASE_URL = require_env("LMS_BASE_URL").rstrip("/")
    
    # 認証ファイルのパス
    CREDENTIALS_DIR = BASE_DIR / "credentials"
    GMAIL_CREDENTIALS = CREDENTIALS_DIR / "credentials.json"
    GMAIL_TOKEN = CREDENTIALS_DIR / "token.json"
    
    # Gmail設定
    SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]

settings = Settings()
