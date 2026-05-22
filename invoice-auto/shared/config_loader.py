# /path/to/wonder-gym-teacher-toolkit/invoice-auto/shared/config_loader.py
from dotenv import load_dotenv
import os

def load_common_env():
    """親ディレクトリにある共通.envを読み込む"""
    current_dir = os.path.dirname(__file__)
    env_path = os.path.abspath(os.path.join(current_dir, "../..", ".env"))
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        raise FileNotFoundError(f".env not found at: {env_path}")
