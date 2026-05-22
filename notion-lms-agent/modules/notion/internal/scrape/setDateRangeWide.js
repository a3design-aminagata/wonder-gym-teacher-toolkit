// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/notion/internal/scrape/setDateRangeWide.js
import { wait } from "../../../common/wait.js";
import { saveJSON } from "../../../common/saveUtils.js";

import {
	applyTeacherFilter,
	switchToPast, // ← 実体は「日付レンジを広げる」処理
	fetchTimelineWithDetail,
} from "./scrapeCommon.js";

import {
	parseRaw,
	parseCourse,
	parseDate,
	parseCount,
} from "../parse/parseUtils.js";

/**
 * Notion スケジュールを
 * 「前月1日 〜 今月+2ヶ月を含むレンジ」で取得する
 */
export async function scrapeScheduleRange(page) {
	const ok = await applyTeacherFilter(page);
	if (!ok) {
		console.log("❌ 講師が見つからないので終了します。");
		return [];
	}

	// 日付レンジを広げる（前月1日〜今月+2ヶ月）
	await switchToPast(page);

	const results = await fetchTimelineWithDetail(page, {
		parseRaw,
		parseCourse,
		parseDate,
		parseCount,
	});

	await saveJSON("schedules.json", results);
	console.log("🎉 schedules.json を保存しました");

	return results;
}
