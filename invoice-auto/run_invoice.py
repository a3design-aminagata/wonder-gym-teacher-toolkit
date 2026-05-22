# /path/to/wonder-gym-teacher-toolkit/invoice-auto/run_invoice.py
import subprocess
import sys
import os

def run_script(script_relative_path, company_key):
    # プロジェクトのルートディレクトリを取得
    base_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(base_dir, script_relative_path)
    
    print(f"\n▶️ 実行中: {script_relative_path} ({company_key})")
    
    # 子スクリプトを実行。PYTHONPATHを通すことで、invoices/内からshared/をインポート可能にする
    env = os.environ.copy()
    env["PYTHONPATH"] = base_dir

    result = subprocess.run(
        [sys.executable, script_path, company_key],
        capture_output=True,
        text=True,
        env=env
    )
    
    print(result.stdout)
    if result.stderr:
        print("⚠️ エラー:")
        print(result.stderr)
        return False
    return True

def main():
    # 引数がある場合はそれを使用、ない場合はデフォルトで "all" にする
    if len(sys.argv) < 2:
        print("💡 引数が指定されていないため、デフォルトの 'all' で実行します。")
        target = "all"
    else:
        target = sys.argv[1].lower()
    
    if target == "all":
        targets = ["wl", "connect"]
    elif target in ["wl", "connect"]:
        targets = [target]
    else:
        print(f"❌ 不明なターゲットです: {target}")
        return

    for cp in targets:
        print(f"\n" + "="*40)
        print(f" 🏢 {cp.upper()} の処理を開始します")
        print("="*40)
        
        # 1. 請求書ダウンロード
        if run_script("invoices/invoice_automation.py", cp):
            # 2. Gmail下書き作成
            run_script("invoices/invoice_gmail.py", cp)

    print("\n✅ 全ての処理が完了しました！")

if __name__ == "__main__":
    main()