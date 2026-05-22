// modules/notion/internal/scrape/scrapeScheduleCore.js
import { applyTeacherFilter, fetchTimelineWithDetail } from "./scrapeCommon.js";

import {
	parseRaw,
	parseCourse,
	parseDate,
	parseCount,
} from "../parse/parseUtils.js";

export async function scrapeScheduleCore(page, options = {}) {
	const {
		expandDateRange = false,
		expandDateRangeFn = null,
		skipTeacherFilter = false,
	} = options;

	if (!skipTeacherFilter) {
		const ok = await applyTeacherFilter(page);
		if (!ok) {
			throw new Error("講師が見つかりません");
		}
	}

	if (expandDateRange && expandDateRangeFn) {
		await expandDateRangeFn(page);
	}

	const results = await fetchTimelineWithDetail(page, {
		parseRaw,
		parseCourse,
		parseDate,
		parseCount,
	});

	return results;
}
