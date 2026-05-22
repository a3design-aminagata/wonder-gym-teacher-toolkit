// modules/notion/run/run_scrapeSchedule.js
/**
 * run_scrapeSchedule.js
 *
 * Notion スケジュールスクレイピングの実行エントリ
 * - CLI / 手動実行用
 * - 他パイプラインからも呼ばれる想定
 */

import { scrapeSchedule } from "scrapeSchedule.js";

async function run() {
	const args = process.argv.slice(2);

	const mode = args.includes("--range")
		? "range"
		: args.includes("--past")
			? "past"
			: "auto";

	console.log(`▶ Notion scrape mode=${mode}`);
	await scrapeSchedule({ mode });
}

run().catch((e) => {
	console.error("❌ run_scrapeSchedule failed");
	console.error(e);
	process.exit(1);
});
