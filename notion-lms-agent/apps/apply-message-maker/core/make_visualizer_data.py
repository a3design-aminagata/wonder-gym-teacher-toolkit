from pathlib import Path
import json
import os
import re
from datetime import datetime, timedelta

BASE = Path(__file__).resolve().parent

# apply-message-maker 配下
APPLY_DATA_DIR = BASE.parent / "data"

# notion-lms-agent/data 配下（Notion スケジュール）
ROOT_DATA_DIR = BASE.parent.parent.parent / "data"

AVAILABLE_FILE = APPLY_DATA_DIR / "available.json"
COURSES_WITH_GROUPS_FILE = ROOT_DATA_DIR / "courses_with_group_ids.json"
SCHEDULE_FILE = ROOT_DATA_DIR / "schedules.json"

OUTPUT_JS = BASE.parent / "visualizer" / "data.js"
JP_DATE_TIME_RE = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})")

LMS_BASE_URL = (os.getenv("LMS_BASE_URL") or "").strip().rstrip("/")
if not LMS_BASE_URL:
    raise RuntimeError("LMS_BASE_URL が未設定です。.env に設定してください。")
LMS_ATTENDANCE_BASE_URL = f"{LMS_BASE_URL}/lecturer-portal/online-lesson-attendances"
LMS_USER_GROUPS_BASE_URL = f"{LMS_ATTENDANCE_BASE_URL}/user_groups"


# ----------------------------------------------------------------------
# courses_with_group_ids.json を読み込んで、
# (area, month) → コース情報 にマップする
#   例:
#   {
#     ("東京", 7): { courseKey: "07月東京マーケ", userGroupIds: ["225"], ... },
#     ("茨城", 6): { courseKey: "06月茨城デザイン", userGroupIds: ["212"], ... },
#     ...
#   }
# ----------------------------------------------------------------------
def load_course_group_map():
    if not COURSES_WITH_GROUPS_FILE.exists():
        print(f"⚠ {COURSES_WITH_GROUPS_FILE} がありません（lmsUrl は付与されません）")
        return {}

    with open(COURSES_WITH_GROUPS_FILE, "r", encoding="utf-8") as f:
        arr = json.load(f)

    mapping = {}
    for c in arr:
        area = c.get("area")
        month = c.get("month")
        if area is None or month is None:
            continue
        mapping[(area, month)] = c

    print(f"🔗 course_map loaded: {len(mapping)} entries")
    return mapping


COURSE_MAP = load_course_group_map()


# ----------------------------------------------------------------------
# lmsUrl を生成する
#   - userGroupIds があれば /user_groups/{id}?number_of_times={total}
#   - なければ lmsListUrl（一覧画面）か、最後にフォールバック URL
# ----------------------------------------------------------------------
def build_lms_url(area, month, total=None):
    info = COURSE_MAP.get((area, month))

    if info:
        ids = info.get("userGroupIds") or []
        if ids:
            gid = ids[0]
            base = f"{LMS_USER_GROUPS_BASE_URL}/{gid}"
            if total:
                return f"{base}?number_of_times={total}"
            return base

        # ID がない場合は lmsListUrl があればそれを使う
        if info.get("lmsListUrl"):
            return info["lmsListUrl"]

    # マッチするコースが見つからなかったときのフォールバック
    return f"{LMS_USER_GROUPS_BASE_URL}?prefecture={area}&month={month}"


# ----------------------------------------------------------------------
# available.json 読み込み
# ----------------------------------------------------------------------
def load_available():
    with open(AVAILABLE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ----------------------------------------------------------------------
# schedules.json 読み込み（自分の授業スケジュール）
# ----------------------------------------------------------------------
def load_my_schedule():
    with open(SCHEDULE_FILE, "r", encoding="utf-8") as f:
        schedules = json.load(f)

    parsed = []
    skipped = 0
    for s in schedules:
        dt = parse_schedule_datetime(s)
        if not dt:
            skipped += 1
            continue

        course_parts = s.get("courseParts") if isinstance(s, dict) else {}
        parsed.append(
            {
                "datetime": dt,
                "area": course_parts.get("area", ""),
                "month": course_parts.get("month"),
            }
        )

    if skipped:
        print(f"⚠ schedules.json の {skipped} 件は日時を解釈できずスキップしました")
    return parsed


def parse_schedule_datetime(schedule_item):
    date_obj = schedule_item.get("date") if isinstance(schedule_item, dict) else None
    if isinstance(date_obj, dict):
        iso = date_obj.get("iso")
        if isinstance(iso, str) and iso:
            try:
                return datetime.fromisoformat(iso)
            except ValueError:
                pass
        date_raw = date_obj.get("raw")
    else:
        date_raw = None

    count_obj = schedule_item.get("count") if isinstance(schedule_item, dict) else None
    count_raw = count_obj.get("raw") if isinstance(count_obj, dict) else None

    for raw in (date_raw, count_raw):
        if not isinstance(raw, str):
            continue
        m = JP_DATE_TIME_RE.search(raw)
        if not m:
            continue
        y, mo, d, tm = m.groups()
        try:
            return datetime.strptime(f"{int(y):04d}-{int(mo):02d}-{int(d):02d} {tm}", "%Y-%m-%d %H:%M")
        except ValueError:
            continue

    return None


# ----------------------------------------------------------------------
# available.json の raw から area / month / total を抽出する
#   raw: "・【茨城】2025年6月開講(6ヶ月) 17回目/26回目"
#   → area = 茨城, month = 6, total = 26
# ----------------------------------------------------------------------
def normalize_available_items(items):
    normalized = []

    for item in items:
        raw = item["raw"]

        # エリア
        m_area = re.search(r"【([^】]+)】", raw)
        area = m_area.group(1) if m_area else item["area"]

        # 開講月
        m_month = re.search(r"(\d{4})年(\d{1,2})月", raw)
        month = int(m_month.group(2)) if m_month else None

        # 回数（current / total）
        m_cnt = re.search(r"(\d+)回目/(\d+)回目", raw)
        if m_cnt:
            current = int(m_cnt.group(1))
            total = int(m_cnt.group(2))
        else:
            current = None
            total = None

        normalized.append(
            {
                "date": item["date"],
                "time": item["time"],
                "area": area,
                "month": month,
                "raw": raw,
                "current": current,
                "total": total,
                # ★ ここで出欠URLを組み立てる
                "lmsUrl": build_lms_url(area, month, total),
            }
        )

    return normalized


# ----------------------------------------------------------------------
# 未調整コマと自分の授業の被りを判定
# ----------------------------------------------------------------------
def detect_conflicts(avail, my):
    for a in avail:
        dt = datetime.strptime(a["date"] + " " + a["time"], "%Y-%m-%d %H:%M")
        a["type"] = "normal"  # default

        for m in my:
            # 1時間以内の差 → 同時間帯とみなす
            if abs((m["datetime"] - dt)) < timedelta(hours=1):
                a["type"] = "conflict"
                break

    return avail


# ----------------------------------------------------------------------
# 自分のスケジュールを可視化用セルに変換
# ----------------------------------------------------------------------
def collect_my_schedule_cells(my):
    cells = []
    for m in my:
        date = m["datetime"].strftime("%Y-%m-%d")
        time = m["datetime"].strftime("%H:%M")
        cells.append(
            {
                "date": date,
                "time": time,
                "area": m["area"],
                "month": m["month"],
                "type": "mine",
            }
        )
    return cells


# ----------------------------------------------------------------------
# JS (visualizer/data.js) に書き出し
# ----------------------------------------------------------------------
def write_js_file(data):
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("const VISUALIZER_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"✔ visualizer/data.js を更新しました → {OUTPUT_JS}")


# ----------------------------------------------------------------------
# メイン
# ----------------------------------------------------------------------
def main():
    available = normalize_available_items(load_available())
    my_schedule = load_my_schedule()

    # conflict 判定
    available = detect_conflicts(available, my_schedule)

    # 自分の授業セル
    my_cells = collect_my_schedule_cells(my_schedule)

    # visualizer 用データ
    final_data = {
        "available": available,
        "mine": my_cells,
    }

    write_js_file(final_data)


if __name__ == "__main__":
    main()
