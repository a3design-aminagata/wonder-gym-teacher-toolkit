// modules/notion/scrape/schedule/index.js
import { launchBrowser } from "../../../common/browser.js";
import { wait } from "../../../common/wait.js";
import { saveJSON } from "../../../common/saveUtils.js";

import { scrapeScheduleRange } from "./range.js";
import { scrapeScheduleManual } from "./manual.js";

import { hasDateRangeUI } from "../../internal/scrape/scrapeUI.js";
import { NOTION_VIEW_URL } from "./constants.js";

// 🔒 重複除去（pageUrlベース）
function dedupeByPageUrl(results) {
	const map = new Map();
	for (const item of results) {
		if (!map.has(item.pageUrl)) {
			map.set(item.pageUrl, item);
		}
	}
	return Array.from(map.values());
}
export async function scrapeSchedule(options = {}) {
	const { keepBrowserOpen = false } = options;
	const browser = await launchBrowser();
	const page = await browser.newPage();

	try {
		await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
		await wait(1500);

		const rangeAvailable = await hasDateRangeUI(page);

		let results = [];

		if (rangeAvailable) {
			console.log("📅 日付レンジ UI が見つかりました → range scrape");
			results = await scrapeScheduleRange(page);
		} else {
			console.log("📅 日付レンジ UI が見つかりません → manual scrape");
			results = await scrapeScheduleManual(page);
		}

		results = dedupeByPageUrl(results);

		await saveJSON("schedules.json", results);
		console.log("🎉 schedules.json を保存しました");

		if (keepBrowserOpen) {
			return { results, browser, page };
		}
		return results;
	} finally {
		if (!keepBrowserOpen) {
			await browser.close();
		}
	}
}
