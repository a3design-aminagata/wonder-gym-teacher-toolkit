// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/notion_preview.js
import puppeteer from "puppeteer";
import { NOTION_VIEW_URL } from "../../modules/notion/scrape/schedule/constants.js";
import { applyTeacherFilter } from "../../modules/notion/internal/scrape/scrapeCommon.js";
import { loadMore } from "../../modules/notion/internal/actions/notionActions.js";
import { wait } from "../../modules/common/wait.js";
import { waitForManual } from "../../modules/notion/internal/runtime/waitForManual.js";

function buildLaunchOptions(profileDirectory) {
	const args = ["--start-maximized"];
	if (profileDirectory) {
		args.push(`--profile-directory=${profileDirectory}`);
	}
	return {
		headless: false,
		defaultViewport: null,
		args,
	};
}

export async function runNotionPreview({ profileDirectory = null } = {}) {
	console.log("🌐 Notionプレビューを起動します（閲覧のみ、保存なし）");

	const browser = await puppeteer.launch(buildLaunchOptions(profileDirectory));
	const page = await browser.newPage();

	try {
		await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
		await wait(1500);

		let filterApplied = false;
		try {
			filterApplied = await applyTeacherFilter(page);
		} catch (e) {
			console.warn("⚠ 講師フィルタの自動適用に失敗しました。手動で設定して続行できます。");
			console.warn(e?.message || e);
		}

		if (filterApplied) {
			console.log("⏳ すべて読み込み中 (load more)...");
			await loadMore(page);
			console.log("✅ 全講師読み込みまで完了しました。");
		}

		console.log("✅ ブラウザは開いたままです。");
		console.log("    Enter を押すと終了し、ブラウザを閉じます。閉じたくなければプロセスを残したままにしてください。");
		await waitForManual();
	} finally {
		try {
			await browser.close();
		} catch (_) {
			// ignore
		}
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runNotionPreview().catch((e) => {
		console.error("❌ notion_preview failed");
		console.error(e);
		process.exit(1);
	});
}
