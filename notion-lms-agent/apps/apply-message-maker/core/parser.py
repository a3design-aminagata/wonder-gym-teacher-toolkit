from pathlib import Path
import json
import re
from datetime import date

BASE = Path(__file__).resolve().parent.parent
WORK = BASE / "work"
DATA = BASE / "data"

INPUT_FILE = WORK / "input.txt"
OUTPUT_FILE = DATA / "available.json"


def load_input():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        return f.read()


def normalize_zenkaku(text: str) -> str:
    """
    ざっくり正規化：
    - 全角カッコ（（ ））→ 半角
    - 波ダッシュ/全角チルダ系の揺れ
    - 区切りの全角スペースなど
    """
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("〜", "～")
    text = re.sub(r"[ \t]+", " ", text)
    return text


# ---------------------------
# 1) ブロック抽出
# ---------------------------
def extract_blocks(text):
    """
    3種類を吸う：
    A) [info][title] ... [/title] ... [/info]
    B) [info] ... [/info]
    C) [info] が無い “生メール本文” でも、見出し行（■12/15(月) ...）からブロック化
    """
    text = normalize_zenkaku(text)

    results = []

    # A) title あり
    pat_a = re.compile(r"\[info\]\[title\](.*?)\[/title\](.*?)\[/info\]", re.DOTALL)
    for title, body in pat_a.findall(text):
        results.append({"title": title.strip(), "body": body.strip()})

    # B) title なし
    text_wo_a = pat_a.sub("", text)
    pat_b = re.compile(r"\[info\](.*?)\[/info\]", re.DOTALL)
    for body in pat_b.findall(text_wo_a):
        results.append({"title": "", "body": body.strip()})

    # C) [info] が無い場合： "■" 見出しで区切る
    # 例:
    # ■12/15(月) 未調整コマ
    # 10:00〜 【大阪】...
    if not results:
        lines = text.splitlines()
        idxs = [i for i, l in enumerate(lines) if re.match(r"^\s*■\s*\d{1,2}/\d{1,2}", l)]
        if idxs:
            for n, start in enumerate(idxs):
                end = idxs[n + 1] if n + 1 < len(idxs) else len(lines)
                title = lines[start].strip()
                body = "\n".join(lines[start + 1:end]).strip()
                results.append({"title": title, "body": body})

    return results


# ---------------------------
# 2) 日付パース
# ---------------------------
def parse_block_date(title):
    """
    例: "■11/26(水) 未調整コマ一覧" → "2026-11-26"（実行日に応じて推定）
    title が空なら None を返す（本文側の行から日付を拾う前提）
    """
    if not title:
        return None

    m = re.search(r"(\d{1,2})/(\d{1,2})", title)
    if not m:
        return None

    month = int(m.group(1))
    day = int(m.group(2))

    today = date.today()

    def _to_date(y: int):
        try:
            return date(y, month, day)
        except ValueError:
            return None

    # まず当年を試し、年跨ぎ（12月→翌1月など）だけ翌年へ寄せる
    this_year = _to_date(today.year)
    if this_year is not None:
        if this_year >= today or (today - this_year).days <= 180:
            return f"{today.year:04d}-{month:02d}-{day:02d}"

    next_year = _to_date(today.year + 1)
    if next_year is not None:
        return f"{today.year + 1:04d}-{month:02d}-{day:02d}"

    return None


def parse_jp_date_to_iso(line: str):
    """
    例: "2025年12月14日(日)" → "2025-12-14"
    """
    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", line)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{y:04d}-{mo:02d}-{d:02d}"


# ---------------------------
# 3) アイテムパース
# ---------------------------
def parse_items_from_title_style(date_str, body):
    """
    既存形式：
      10:00～
      ・【大阪】... 9回目/25回目
    """
    lines = [l.rstrip() for l in body.splitlines() if l.strip()]
    items = []
    current_time = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 時間行（例: 11:00～）
        m_time = re.match(r"(\d{1,2}:\d{2})～", line)
        if m_time:
            current_time = m_time.group(1)
            i += 1
            continue

        # 授業行（・で始まる）
        if current_time and line.startswith("・"):
            items.append(build_item(date_str, current_time, line))
            i += 1
            continue

        i += 1

    return items


def parse_items_from_inline_datetime(body):
    """
    title なし [info] で来る形式（1行完結想定）：
      2025年12月14日(日) 09:00 ~ 10:00【東京】... 6回目/22回目

    ここでは開始時刻だけを time に採用（現状スキーマ互換のため）
    """
    lines = [l.strip() for l in body.splitlines() if l.strip()]
    items = []

    for line in lines:
        # 例: 2025年12月14日(日) 09:00 ~ 10:00【東京】...
        m = re.search(r"(\d{4}年\d{1,2}月\d{1,2}日).*?(\d{1,2}:\d{2})\s*[~～-]\s*(\d{1,2}:\d{2})", line)
        if not m:
            continue

        date_str = parse_jp_date_to_iso(line)
        if not date_str:
            continue

        start_time = m.group(2)
        # end_time = m.group(3)  # 必要なら将来スキーマに追加可能

        items.append(build_item(date_str, start_time, line, assume_bullet=False))

    return items


def parse_items_from_compact_lines(date_str, body):
    """
    メール本文にありがちな短縮形式（箇条書き無しでも吸う）：
      10:00〜 【大阪】... 9回目/25回目
      13:00～ 【山形】... 3回目/12回目
    """
    lines = [l.strip() for l in body.splitlines() if l.strip()]
    items = []

    for line in lines:
        # 時刻 + 地域 + 回数が同一行にある
        m_time = re.search(r"(\d{1,2}:\d{2})\s*[～~]\s*", line)
        if not m_time:
            continue

        start_time = m_time.group(1)

        # 地域が【】で入っていることが多いので、それがあれば採用
        if "【" not in line or "】" not in line:
            # 地域が無い行は誤検出しやすいのでスキップ（必要なら緩められる）
            continue

        items.append(build_item(date_str, start_time, line, assume_bullet=False))

    return items


def build_item(date_str, time_str, raw_line, assume_bullet=True):
    """
    raw_line から area / current / total を抽出して item を構築
    """
    line = raw_line.strip()
    if assume_bullet and line.startswith("・"):
        line = line[1:].strip()

    # area 抽出（例： 【島根】 → 島根）
    m_area = re.search(r"【(.*?)】", line)
    area = m_area.group(1) if m_area else ""

    # current/total 抽出（「回目/回目」）
    m_cnt = re.search(r"(\d+)回目/(\d+)回目", line)
    cur = int(m_cnt.group(1)) if m_cnt else None
    total = int(m_cnt.group(2)) if m_cnt else None

    return {
        "date": date_str,
        "time": time_str,
        "area": area,
        "current": cur,
        "total": total,
        "raw": raw_line.strip(),
    }


def main():
    text = load_input()
    blocks = extract_blocks(text)

    results = []

    for block in blocks:
        title = block["title"]
        body = block["body"]

        date_from_title = parse_block_date(title)

        if date_from_title:
            # 既存の title 形式をまず試す
            results.extend(parse_items_from_title_style(date_from_title, body))

            # ついでに短縮行形式も拾う（混在してもOK）
            results.extend(parse_items_from_compact_lines(date_from_title, body))
        else:
            # title なし → 行から日付を拾う形式を解析
            results.extend(parse_items_from_inline_datetime(body))

            # title なしでも「■12/15(月)」が本文に紛れてる可能性があるので補助
            # （本文内に 12/15 があれば 2025固定で採用）
            m_md = re.search(r"(\d{1,2})/(\d{1,2})", body)
            if m_md:
                date_guess = f"2025-{int(m_md.group(1)):02d}-{int(m_md.group(2)):02d}"
                results.extend(parse_items_from_compact_lines(date_guess, body))

    # 重複除去（同一 date+time+raw をキーにする）
    uniq = {}
    for it in results:
        k = (it["date"], it["time"], it["raw"])
        uniq[k] = it
    results = list(uniq.values())

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"解析完了：{len(results)} 件 → {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
