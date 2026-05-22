// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/lib/normalizeSchedule.js
import { normalizeTime, scheduleKeyOf } from "./scheduleKey.js";

export function normalizeSchedule(entry) {
	let date = null;
	let time = null;

	// ① count.raw
	if (entry.count?.raw) {
		const m = entry.count.raw.match(
			/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})/,
		);
		if (m) {
			const [, y, mo, d, t] = m;
			date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
			time = normalizeTime(t);
		}
	}

	// ② iso / time
	if (!date && entry.date?.iso) date = entry.date.iso.slice(0, 10);
	if (!time && entry.date?.time) time = normalizeTime(entry.date.time);

	// ③ raw fallback
	if ((!date || !time) && entry.date?.raw) {
		const mDate = entry.date.raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
		const mTime = entry.date.raw.match(/(\d{1,2}:\d{2})/);
		if (mDate && !date) {
			const [, y, mo, d] = mDate;
			date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
		}
		if (mTime && !time) time = normalizeTime(mTime[1]);
	}

	if (!date || !time) return null;

	const scheduleKey = scheduleKeyOf(date, time);

	const materials =
		entry.detail?.links?.filter((l) => {
			if (!l.url) return false;
			if (l.url.includes("notion.site")) return false;
			if (l.text?.includes("アサイン")) return false;
			if (l.text?.includes("コンテンツにスキップ")) return false;
			return true;
		}) ?? [];

	return {
		scheduleKey,
		date,
		time,
		course: entry.course,
		month: entry.courseParts?.month ?? null,
		area: entry.courseParts?.area ?? null,
		category: entry.courseParts?.category ?? entry.category ?? "",
		count: entry.count ?? null,
		materials,
		pageUrl: entry.pageUrl,
	};
}
