// modules/notion/scrape/schedule/manual.js

import { applyTeacherFilter } from "../../internal/scrape/scrapeCommon.js";
import { waitForManual } from "../../internal/runtime/waitForManual.js";
import { scrapeScheduleCore } from "../../internal/scrape/scrapeScheduleCore.js";
import { loadMore } from "../../internal/actions/notionActions.js";

export async function scrapeScheduleManual(page) {
	console.log("👨‍🏫 講師を自動選択します...");

	const ok = await applyTeacherFilter(page);
	if (!ok) {
		throw new Error("講師が見つかりません");
	}

	// ★ ここに追加：Enter 待ちの前に「もっと読み込む」をすべて実行
	console.log("⏳ データをすべて読み込んでいます（load more...）");
	await loadMore(page);

	console.log("✅ 読み込み完了。期間を設定してください。");
	console.log("完了したら Enter を押してください");
	await waitForManual(); // ここで停止

	const results = await scrapeScheduleCore(page, {
		expandDateRange: false,
		skipTeacherFilter: true, // 既に選んだのでスキップ
	});

	if (!results.length) {
		throw new Error("manual scrape: results empty");
	}

	return results;
}
