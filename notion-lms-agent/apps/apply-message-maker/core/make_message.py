from pathlib import Path
import json
from datetime import datetime, timedelta
import re
from itertools import groupby

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
WORK = BASE / "work"

AVAILABLE_FILE = DATA / "available.json"
CERTIFIED_FILE = DATA / "certified_list.txt"
OUTPUT_FILE = WORK / "message.txt"
JP_DATE_TIME_RE = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})")

def strip_leading_time(raw: str) -> str:
    s = raw.strip()
    s = re.sub(r"^\s*・\s*", "", s)

    # 先頭の日付（例: 2025年12月14日(日) ）を消す
    s = re.sub(r"^\s*\d{4}年\d{1,2}月\d{1,2}日(?:\([^\)]*\))?\s*", "", s)

    # 先頭の時間レンジ or 開始時刻を消す
    s = re.sub(r"^\s*\d{1,2}:\d{2}\s*(?:[～〜]|-|~)\s*(?:\d{1,2}:\d{2})?\s*", "", s)

    return s


def format_time_label(t: str) -> str:
    """'9:00' → '09:00' に揃える"""
    h, m = t.split(":")
    return f"{int(h):02d}:{m}"


def filter_future_items(items):
    today = datetime.today().date()

    filtered = []
    for it in items:
        d = datetime.strptime(it["date"], "%Y-%m-%d").date()
        if d >= today:
            filtered.append(it)
    return filtered

def load_available():
    with open(AVAILABLE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_certified_list():
    """
    certified_list.txt を読み込んで、行ごとの文字列リストにする。
    例: ["茨城4月デ", "京都5月マ", ...]
    """
    if not CERTIFIED_FILE.exists():
        print("⚠ certified_list.txt が data/ にありません（認定判定はスキップされます）。")
        return []

    with open(CERTIFIED_FILE, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    return lines


def group_by_date(items):
    grouped = {}
    for item in items:
        grouped.setdefault(item["date"], []).append(item)
    return grouped


def sort_key(item):
    """
    時間ソート用： "9:00" → datetime
    """
    return datetime.strptime(item["time"], "%H:%M")


def extract_area_and_month_from_raw(raw: str):
    """
    raw から エリア と 開講月 を抜き出す。
    例:
      "・【千葉】2025年7月開講(6ヶ月) 5回目/20回目"
    → ("千葉", 7)
    """
    m = re.search(r"【(?P<area>[^】]+)】(?P<year>\d{4})年(?P<month>\d{1,2})月開講", raw)
    if not m:
        return None, None

    area = m.group("area")
    month = int(m.group("month"))
    return area, month


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


def build_cert_label(raw: str, certified_list):
    """
    raw と certified_list から認定ラベルを返す。
    - 両方（マ・デ）あり → " - 認定"
    - デのみ → " - 認定（デザインの場合）"
    - マのみ → " - 認定（マーケの場合）"
    - なし → ""
    """
    if not certified_list:
        return ""

    area, month = extract_area_and_month_from_raw(raw)
    if not area or not month:
        return ""

    key_prefix = f"{area}{month}月"

    hits = [c for c in certified_list if c.startswith(key_prefix)]
    if not hits:
        return ""

    has_ma = any(h.endswith("マ") for h in hits)
    has_de = any(h.endswith("デ") for h in hits)

    if has_ma and has_de:
        return " - 認定"
    if has_de:
        return " - 認定（デザインの場合）"
    if has_ma:
        return " - 認定（マーケの場合）"
    return ""


def main():
    available = load_available()
    certified_list = load_certified_list()

    removed_items = []  # ← removed.txt 用

    # === 自分のスケジュールを読み込み（conflict除外用） ===
    ROOT_DATA_DIR = BASE.parents[1] / "data"
    SCHEDULE_FILE = ROOT_DATA_DIR / "schedules.json"
    with open(SCHEDULE_FILE, "r", encoding="utf-8") as f:
        my_schedule = json.load(f)

    # mine 用に datetime セット
    my_times = set()
    skipped = 0
    for s in my_schedule:
        dt = parse_schedule_datetime(s)
        if not dt:
            skipped += 1
            continue
        my_times.add((dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")))

    if skipped:
        print(f"⚠ schedules.json の {skipped} 件は日時を解釈できずスキップしました")

    # 直後1時間もNG とする
    my_next_times = set()
    for d, t in my_times:
        dt = datetime.strptime(f"{d} {t}", "%Y-%m-%d %H:%M")
        next_dt = dt + timedelta(hours=1)
        my_next_times.add((next_dt.strftime("%Y-%m-%d"), next_dt.strftime("%H:%M")))

        # === 今日より前（＋今日）を除外するが、removed に理由付きで残す ===
        today = datetime.today().date()

        kept = []
        for item in available:
            d = datetime.strptime(item["date"], "%Y-%m-%d").date()
            if d > today:
                kept.append(item)
            else:
                removed_items.append({**item, "reason": "past_or_today"})

        available = kept


    # === STEP②: 自分の時間 / 直後の時間 を削除 ===
    cleaned = []
    for item in available:
        key = (item["date"], item["time"])
        if key in my_times:
            removed_items.append({**item, "reason": "mine"})
            continue
        if key in my_next_times:
            removed_items.append({**item, "reason": "next_to_mine"})
            continue
        cleaned.append(item)

    available = cleaned

    # === STEP③: 土日 / 18時以降 を削除 ===
    cleaned2 = []
    for item in available:
        d = item["date"]
        t = item["time"]
        dt = datetime.strptime(d, "%Y-%m-%d")
        weekday_jp = "月火水木金土日"[dt.weekday()]
        hour = int(t.split(":")[0])

        # 土日削除
        if weekday_jp in ["土", "日"]:
            removed_items.append({**item, "reason": "weekend"})
            continue

        # 18時以降削除
        if hour >= 18:
            removed_items.append({**item, "reason": "after18"})
            continue

        cleaned2.append(item)

    available = cleaned2

    # === removed.txt に書き出し ===
    # === removed_items を日付 + 時間でソート（早い順） ===
    def sort_key_removed(it):
        """
        it: { "date": "2025-12-14", "time": "10:00", ... } みたいな dict を想定
        """
        date_str = it.get("date", "")
        time_str = it.get("time", "")

        try:
            dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            return dt
        except Exception:
            # 万が一変な形式なら最後尾に飛ばす
            return datetime.max

    removed_items.sort(key=sort_key_removed)

    # === removed.txt に整形して書き出し ===
    REMOVED_FILE = WORK / "removed.txt"

    # 理由ごとにまとめる
    reason_groups = {}
    for it in removed_items:
        r = it["reason"]
        reason_groups.setdefault(r, []).append(it)

    # 見出し名マッピング
    reason_titles = {
        "mine": "【conflict】",
        "next_to_mine": "【conflict_next】",
        "weekend": "【weekend】",
        "after18": "【after18】",
        "past_or_today": "【past_or_today】",
    }

    with open(REMOVED_FILE, "w", encoding="utf-8") as f:
        for reason in ["mine", "next_to_mine", "weekend", "after18", "past_or_today"]:
            if reason not in reason_groups:
                continue

            f.write(reason_titles[reason] + "\n\n")

            # 日付ごとにまとめる
            groups = {}
            for it in reason_groups[reason]:
                groups.setdefault(it["date"], []).append(it)

            for date in sorted(groups.keys()):
                dt = datetime.strptime(date, "%Y-%m-%d")
                weekday_jp = "月火水木金土日"[dt.weekday()]

                f.write(f"■ {dt.month:02d}/{dt.day:02d}({weekday_jp})\n")

                # 同じ日付の中では時間順
                for it in sorted(groups[date], key=lambda x: x["time"]):
                    time_label = format_time_label(it["time"])
                    raw_body = strip_leading_time(it["raw"])

                    # 認定ラベル
                    label = build_cert_label(it["raw"], certified_list)
                    out = f"・{time_label} {raw_body}{label}"

                    f.write(out + "\n")

                f.write("\n")  # 日付ブロック間スペース

    # === 出力処理 ===
    grouped = group_by_date(available)

    lines = []
    lines.append("未調整コマのうち、以下のコマで対応可能です。\n")
    lines.append("【対応可能】")

    # 日付ごと
    for date in sorted(grouped.keys()):
        dt = datetime.strptime(date, "%Y-%m-%d")
        weekday_jp = "月火水木金土日"[dt.weekday()]
        lines.append(f"\n■ {dt.month:02d}/{dt.day:02d}({weekday_jp})")

        items = sorted(grouped[date], key=sort_key)

        for time, group in groupby(items, key=lambda x: x["time"]):
            group_list = list(group)

            time_label = format_time_label(time)
            indent_len = len("・" + time_label + " ")

            for idx, item in enumerate(group_list):
                raw_body = strip_leading_time(item["raw"])
                label = build_cert_label(item["raw"], certified_list)

                if idx == 0:
                    lines.append(f"・{time_label} {raw_body}{label}")
                else:
                    indent = " " * indent_len
                    lines.append(f"{indent}{raw_body}{label}")

    lines.append("\n0件でも、多くてもどちらでも大丈夫です。")
    lines.append("もし埋まらない日があれば、入れていただけると嬉しいです。")
    lines.append("ご確認のほどよろしくお願いいたします。")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"作成完了 → {OUTPUT_FILE}")
    print(f"削除リスト → {REMOVED_FILE}")


if __name__ == "__main__":
    main()
