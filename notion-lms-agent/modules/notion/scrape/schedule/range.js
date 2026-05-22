// modules/notion/scrape/schedule/range.js

import { scrapeScheduleCore } from "../../internal/scrape/scrapeScheduleCore.js";
import { switchToPast } from "../../internal/scrape/scrapeCommon.js";

export async function scrapeScheduleRange(page) {
	const results = await scrapeScheduleCore(page, {
		expandDateRange: true,
		expandDateRangeFn: switchToPast,
	});

	if (!results.length) {
		throw new Error("range scrape: results empty");
	}

	return results;
}
