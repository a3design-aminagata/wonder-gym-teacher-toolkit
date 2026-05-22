from pathlib import Path
import json
from datetime import datetime, timedelta

# === パス設定 ===
BASE = Path(__file__).resolve().parent.parent   # apply-message-maker/
DATA = BASE / "data"
SCHEDULE_FILE = DATA / "schedules.json"


def load_schedules():
    """
    schedules.json を読み込み、datetime のリストにして返す。
    """
    if not SCHEDULE_FILE.exists():
        print("⚠️ schedules.json が data/ にありません。")
        return []

    with open(SCHEDULE_FILE, "r", encoding="utf-8") as f:
        schedules = json.load(f)

    parsed = []
    for s in schedules:
        dt = datetime.fromisoformat(s["date"]["iso"])
        parsed.append(dt)

    return parsed


def is_conflict(target_dt, my_schedule):
    """
    target_dt と既存スケジュールの差が ±1時間以内なら衝突扱い。
    """
    for dt in my_schedule:
        if abs((dt - target_dt)) < timedelta(hours=1):
            return True
    return False


def filter_available(parsed_items):
    """
    parser が作った available.json 相当のリストを受け取り、
    衝突するコマを除外して返す。
    """
    my_schedule = load_schedules()
    available = []

    for item in parsed_items:
        dt = datetime.strptime(
            item["date"] + " " + item["time"], "%Y-%m-%d %H:%M"
        )
        if not is_conflict(dt, my_schedule):
            available.append(item)

    return available
