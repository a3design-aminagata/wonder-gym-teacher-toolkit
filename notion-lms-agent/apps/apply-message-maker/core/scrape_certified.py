import requests
import json
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
REPO_ROOT = Path(__file__).resolve().parents[4]


def load_dotenv_fallback(path: Path):
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_dotenv_fallback(REPO_ROOT / ".env")

CERTIFIED_SHEET_GVIZ_URL = os.getenv("CERTIFIED_SHEET_GVIZ_URL", "").strip()

OUTPUT = DATA / "certified_list.txt"


def fetch_sheet():
    if not CERTIFIED_SHEET_GVIZ_URL:
        raise RuntimeError(
            "CERTIFIED_SHEET_GVIZ_URL が未設定です。.env に設定してください。"
        )

    print("🔍 Google Sheets（D列）を取得中…")

    r = requests.get(CERTIFIED_SHEET_GVIZ_URL)
    r.raise_for_status()

    # gviz API は JSON っぽい文字列だが、"google.visualization.Query.setResponse(" で囲まれている
    text = r.text

    # 囲いを除去
    start = text.find("(") + 1
    end = text.rfind(")")
    json_text = text[start:end]

    data = json.loads(json_text)

    rows = data["table"]["rows"]

    cert_list = []
    for row in rows:
        if row["c"] and row["c"][0]:
            value = row["c"][0]["v"]
            if isinstance(value, str) and value.strip():
                cert_list.append(value.strip())

    return cert_list


def main():
    lst = fetch_sheet()

    if not lst:
        print("⚠ D列から取得できたデータが 0 件です。")
        return

    with open(OUTPUT, "w", encoding="utf-8") as f:
        for item in lst:
            f.write(item + "\n")

    print(f"✔ 認定リスト抽出完了 → {OUTPUT}")
    print(f"件数: {len(lst)}")


if __name__ == "__main__":
    main()
