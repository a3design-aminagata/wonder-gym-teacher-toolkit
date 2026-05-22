// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/notion/internal/runtime
export async function waitForManual() {
	console.log("\n🛑 ===============================");
	console.log("Notionで講師・期間を設定してください");
	console.log("完了したら Enter を押してください");
	console.log("=================================\n");

	process.stdin.setRawMode(true);
	process.stdin.resume();

	return new Promise((resolve) => {
		process.stdin.once("data", () => {
			process.stdin.setRawMode(false);
			process.stdin.pause();
			console.log("▶️ 再開\n");
			resolve();
		});
	});
}
