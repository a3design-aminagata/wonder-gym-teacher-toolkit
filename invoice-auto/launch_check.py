# /path/to/wonder-gym-teacher-toolkit/invoice-auto/launch_check.py
import datetime
import subprocess
from pathlib import Path

def main():
    today = datetime.date.today()
    month_key = today.strftime("%Y-%m")

    # 状態保存ディレクトリ
    state_dir = Path.home() / ".runner_state"
    state_dir.mkdir(exist_ok=True)

    state_file = state_dir / f"invoice_auto_{month_key}"

    # すでに今月実行済みならスキップ
    if state_file.exists():
        print(f"Invoice auto already executed for {month_key}. Skipping.")
        return

    project_dir = Path("/path/to/wonder-gym-teacher-toolkit/invoice-auto")

    venv_python = project_dir / "venv" / "bin" / "python"
    run_script = project_dir / "run_invoice.py"

    print("Running invoice automation...")

    subprocess.run(
        [str(venv_python), str(run_script)],
        cwd=str(project_dir),
        check=True,
    )

    # 成功したらフラグ作成
    state_file.write_text(
        f"executed_at={datetime.datetime.now().isoformat()}\n"
    )

    print("Invoice automation completed.")

if __name__ == "__main__":
    main()
