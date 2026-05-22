// modules/notion/scrape/schedule/auto.js

import { launchBrowser } from "../../../common/browser.js";
import { wait } from "../../../common/wait.js";

import {
	applyTeacherFilter,
	fetchTimelineWithDetail,
} from "../../internal/scrape/scrapeCommon.js";

import {
	parseRaw,
	parseCourse,
	parseDate,
	parseCount,
} from "../../internal/parse/parseUtils.js";
import { NOTION_VIEW_URL } from "./constants.js";

const TARGET_TEACHER = (process.env.NAME || "").trim();

if (!TARGET_TEACHER) {
	throw new Error("process.env.NAME が未設定です");
}

export async function scrapeScheduleAuto() {
	const browser = await launchBrowser();
	const page = await browser.newPage();

	try {
		await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
		await wait(1500);

		const ok = await applyTeacherFilter(page);
		if (!ok) {
			throw new Error(`講師が見つかりません: ${TARGET_TEACHER}`);
		}

		const results = await fetchTimelineWithDetail(page, {
			parseRaw,
			parseCourse,
			parseDate,
			parseCount,
		});

		if (!results.length) {
			throw new Error("timeline が 0 件です");
		}

		return results;
	} finally {
		await browser.close();
	}
}
