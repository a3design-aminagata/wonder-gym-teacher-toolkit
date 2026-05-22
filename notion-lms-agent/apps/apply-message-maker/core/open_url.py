from pathlib import Path
import re
import subprocess

BASE = Path(__file__).resolve().parent.parent
WORK = BASE / "work"
INPUT_FILE = WORK / "input.txt"

CHROME_PROFILE = "Profile 5"

def extract_urls(text):
    pattern = r"https?://[^\s]+"
    return re.findall(pattern, text)

def open_in_chrome_profile(url: str, profile: str = CHROME_PROFILE):
    # macOS の open コマンドで Chrome の特定プロファイルを指定して起動
    cmd = [
        "open",
        "-na", "Google Chrome",        # 新しいインスタンスを起動
        "--args",
        f"--profile-directory={profile}",
        url,
    ]
    # デバッグ用に表示（要らなければ消してOK）
    print("  実行コマンド:", " ".join(cmd))

    subprocess.run(cmd)

def main():
    if not INPUT_FILE.exists():
        print("⚠ input.txt が見つかりません")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        text = f.read()

    urls = extract_urls(text)
    urls = list(dict.fromkeys(urls))  # 重複削除（順番維持）

    if not urls:
        print("⚠ URL が見つかりませんでした")
        return

    print(f"🔗 発見した URL: {len(urls)} 件")
    for url in urls:
        print(f"→ 開く(Profile 5): {url}")
        open_in_chrome_profile(url)

    print("\n✨ URL を Chrome Profile 5 で開きました（はず）")

def run():
    main()

if __name__ == "__main__":
    main()
