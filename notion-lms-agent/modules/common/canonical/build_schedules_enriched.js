// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/canonical/build_schedules_enriched.js
/**
 * schedules.json / schedules_past.json に
 * lmsUrl を付与した canonical データを生成する
 *
 * 出力:
 *   data/schedules_enriched.json
 *
 * 方針:
 * - 日時の一次情報は entry.date.iso / entry.date.time のみ
 * - 仮日付・count.raw からの再パースは禁止
 * - 未確定データは status で明示
 * - 壊れたデータは静かに握り潰さず、明示的に落とす
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LMS_USER_GROUPS_URL } from "../../lms/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// project root
const ROOT = path.resolve(__dirname, "..", "..", "..");

// data paths
const schedulesPath = path.join(ROOT, "data", "schedules.json");
const schedulesPastPath = path.join(ROOT, "data", "schedules_past.json");
const coursesPath = path.join(ROOT, "data", "courses_with_group_ids.json");
const outPath = path.join(ROOT, "data", "schedules_enriched.json");

function extractDateTime(entry) {
	// ① すでに iso がある（正）
	if (entry.date?.iso && entry.date?.time) {
		return {
			date: entry.date.iso.slice(0, 10),
			time: entry.date.time,
		};
	}

	// ② count.raw から抽出
	if (entry.count?.raw) {
		const m = entry.count.raw.match(
			/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})/,
		);
		if (m) {
			const [, y, mo, d, t] = m;
			return {
				date: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
				time: t,
			};
		}
	}

	// ③ ここに来たら本当に異常
	return null;
}

// === util ===
function readJsonSafe(p, { allowBroken = false } = {}) {
	try {
		if (!fs.existsSync(p)) return [];
		return JSON.parse(fs.readFileSync(p, "utf8"));
	} catch (e) {
		if (allowBroken) {
			console.warn(`⚠️ Skip broken JSON: ${p}`);
			return [];
		}
		throw e;
	}
}

// LMS URL を組み立てる
function buildLmsUrl(entry, courseMap) {
	const courseKey = entry.course;
	const courseInfo = courseMap.get(courseKey);
	if (!courseInfo) return null;

	const groupIds = courseInfo.userGroupIds || [];
	if (!groupIds.length) return null;

	const total = entry.count?.total;
	if (!total) return null;

	const lastGroupId = groupIds[groupIds.length - 1];

	return `${LMS_USER_GROUPS_URL}/${lastGroupId}?number_of_times=${total}`;
}

export async function buildSchedulesEnriched() {
	const includePast = process.env.INCLUDE_PAST === "1";

	const schedules = readJsonSafe(schedulesPath);
	const schedulesPast = includePast
		? readJsonSafe(schedulesPastPath, { allowBroken: true })
		: [];

	if (!includePast) {
		console.log("ℹ️ schedules_past.json は読み込んでいません");
	}

	const courses = readJsonSafe(coursesPath);
	const courseMap = new Map(courses.map((c) => [c.courseKey, c]));

	const all = schedules.concat(schedulesPast).map((entry, idx) => {
		const dt = extractDateTime(entry);

		if (!dt) {
			console.error("❌ date を生成できない entry");
			console.error("  index:", idx);
			console.error("  course:", entry.course);
			console.error("  pageUrl:", entry.pageUrl);
			console.error("  date:", entry.date);
			console.error("  count.raw:", entry.count?.raw);
			console.error(JSON.stringify(entry, null, 2));
			throw new Error("date 正規化不能エントリ");
		}

		const totalCount =
			entry.count?.total ||
			(entry.detail?.title?.match(/\/(\d+)回目/)?.[1]
				? Number(RegExp.$1)
				: null);

		const entryWithTotal = {
			...entry,
			count: { ...entry.count, total: totalCount },
		};

		return {
			date: dt.date,
			time: dt.time,
			area: entry.courseParts.area,
			month: entry.courseParts.month,
			course: entry.course,
			count: entryWithTotal.count,
			lmsUrl: buildLmsUrl(entryWithTotal, courseMap),
		};
	});

	fs.writeFileSync(outPath, JSON.stringify(all, null, 2), "utf8");

	console.log("✅ Generated:", outPath);
	console.log("  count:", all.length);
}
// ================================
// CLI 実行サポート
// ================================
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		try {
			console.log("▶ buildSchedulesEnriched (standalone)");
			await buildSchedulesEnriched();
		} catch (e) {
			console.error("❌ buildSchedulesEnriched failed");
			console.error(e);
			process.exit(1);
		}
	})();
}
