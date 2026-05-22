// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/build_orphan_visualizer_data.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { buildLessonMap } from "../../modules/common/visualizer/lib/buildLessonMap.js";
import { normalizeSchedule } from "../../modules/common/visualizer/lib/normalizeSchedule.js";
import {
	normalizeTime,
	scheduleKeyOf,
} from "../../modules/common/visualizer/lib/scheduleKey.js";
import { addAttendanceCommentFlagOrphan } from "./enrichers/add_attendance_comment_flag_orphan.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================
// paths
// =====================
const orphanJsonPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"lms_lessons_orphan.json",
);

const schedulesEnrichedPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"schedules_enriched.json",
);

const schedulesRawPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"schedules.json",
);

const lessonsForSchedulesPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"lms_lessons_for_schedules.json",
);

const manualOrphanLessonsPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"manual_orphan_lessons.json",
);
const manualOrphanOverridesPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"manual_orphan_overrides.json",
);

const outPath = path.join(__dirname, "data", "orphan_data.js");
const MANUAL_ORPHAN_RETENTION_MONTHS = Number.isFinite(
	Number(process.env.MANUAL_ORPHAN_RETENTION_MONTHS),
)
	? Number(process.env.MANUAL_ORPHAN_RETENTION_MONTHS)
	: 2;
const AUTO_PENDING_STUDENT_NAME = "生徒未特定（自動）";

// =====================
// safe loaders
// =====================
function loadJsonIfExists(filePath, label) {
	if (!fs.existsSync(filePath)) {
		console.warn(`⚠ ${label} not found, skip: ${filePath}`);
		return null;
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (e) {
		console.warn(`⚠ failed to parse ${label}, skip: ${filePath}`);
		return null;
	}
}

// =====================
// helpers
// =====================
function extractTotalFromLmsUrl(lmsUrl) {
	if (!lmsUrl) return null;
	const m = lmsUrl.match(/number_of_times=(\d+)/);
	return m ? Number(m[1]) : null;
}

function normalizeName(v) {
	return String(v || "").trim();
}

function isAutoPendingUnknownStudent(row, studentName) {
	return (
		normalizeName(studentName) === AUTO_PENDING_STUDENT_NAME &&
		normalizeName(row?.source) === "orphan-override-maker"
	);
}

function parseDateOnly(value) {
	const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	return {
		year: Number(m[1]),
		month: Number(m[2]),
		day: Number(m[3]),
	};
}

function monthDiffFromNow(dateStr, now = new Date()) {
	const parsed = parseDateOnly(dateStr);
	if (!parsed) return null;
	return (
		now.getFullYear() * 12 +
		(now.getMonth() + 1) -
		(parsed.year * 12 + parsed.month)
	);
}

function pruneManualOrphanLessonsByAge(
	rows = [],
	{ retentionMonths = MANUAL_ORPHAN_RETENTION_MONTHS } = {},
) {
	const kept = [];
	const removed = [];

	for (const row of rows) {
		const diff = monthDiffFromNow(row?.date);
		if (typeof diff === "number" && diff >= retentionMonths) {
			removed.push(row);
			continue;
		}
		kept.push(row);
	}

	return { kept, removed };
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadOptionalJsonArray(filePath, label) {
	if (!fs.existsSync(filePath)) return [];
	try {
		const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
		return Array.isArray(parsed) ? parsed : [];
	} catch (e) {
		console.warn(`⚠ failed to parse ${label}, skip: ${filePath}`);
		return [];
	}
}

function parseCountLabelNumber(label) {
	if (!label) return null;
	const m = String(label).match(/(\d+)\s*回目/);
	return m ? Number(m[1]) : null;
}

function buildGoogleMaterialsFromScheduleRaw(rawSchedule) {
	return (
		rawSchedule?.detail?.links?.filter((l) =>
			/^https:\/\/docs\.google\.com\//.test(l.url),
		) ?? []
	);
}

function buildAbsentIndex(rows = []) {
	const list = [];

	for (const lesson of rows) {
		const base = {
			date: lesson.date,
			time: lesson.time,
			course: lesson.course,
			area: lesson.area,
			month: lesson.month,
			scheduleKey: lesson.scheduleKey || `${lesson.date}T${lesson.time}`,
		};

		for (const m of lesson.matchedLessons || []) {
			const isAbsent =
				typeof m.attendance === "string" && m.attendance.includes("不参加");
			if (!isAbsent) continue;

			list.push({
				...base,
				studentName: m.studentName?.trim() || null,
				countLabel: m.countLabel || null,
			});
		}
	}

	return list;
}

function findMakeupOrigin(orphanLesson, absentIndex = []) {
	const matched = orphanLesson?.matchedLessons || [];
	const primary = matched[0];
	if (!primary || !primary.studentName) return null;

	const targetDate = new Date(`${orphanLesson.date}T${orphanLesson.time || "00:00"}`);

	const candidates = absentIndex
		.filter((a) => a.studentName === primary.studentName)
		.map((c) => {
			let score = 0;

			if (c.countLabel && primary.countLabel && c.countLabel === primary.countLabel)
				score += 4;
			if (c.course && orphanLesson.course && c.course === orphanLesson.course)
				score += 3;
			if (c.area && orphanLesson.area && c.area === orphanLesson.area)
				score += 2;
			if (
				typeof c.month !== "undefined" &&
				typeof orphanLesson.month !== "undefined" &&
				Number(c.month) === Number(orphanLesson.month)
			)
				score += 1;

			const candidateDate = new Date(`${c.date}T${c.time || "00:00"}`);
			const diffMs = Math.abs(targetDate - candidateDate);
			const isPast = candidateDate <= targetDate;

			return { ...c, score, diffMs, isPast };
		});

	if (!candidates.length) return null;

	const past = candidates.filter((c) => c.isPast);
	const pool = past.length ? past : candidates;

	pool.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.diffMs - b.diffMs;
	});

	const best = pool[0];
	if (!best) return null;

	return {
		date: best.date,
		time: best.time,
		scheduleKey: best.scheduleKey,
		course: best.course,
		area: best.area,
		month: best.month,
		countLabel: best.countLabel,
		studentName: best.studentName,
	};
}

function makeOrphanDedupKey(item) {
	const scheduleKey =
		item?.scheduleKey || scheduleKeyOf(item?.date || "", normalizeTime(item?.time));
	const studentName = normalizeName(item?.studentName || item?.makeupOrigin?.studentName);
	return `${scheduleKey}|${studentName}`;
}

function buildRegisteredManualKeys(rows = []) {
	const keys = new Set();

	for (const row of rows) {
		const scheduleKey =
			row?.scheduleKey || scheduleKeyOf(row?.date || "", normalizeTime(row?.time));
		const students = Array.isArray(row?.matchedLessons)
			? row.matchedLessons
					.map((m) => normalizeName(m?.studentName))
					.filter(Boolean)
			: [];

		for (const student of students) {
			keys.add(`${scheduleKey}|${student}`);
		}
	}

	return keys;
}

function normalizeHttpUrl(value) {
	const url = String(value || "").trim();
	if (!/^https?:\/\//.test(url)) return "";
	return url.replace(/\/+$/, "");
}

function makeMaterialList(materials = []) {
	const out = [];
	const seen = new Set();

	for (const m of materials) {
		const url = normalizeHttpUrl(m?.url);
		if (!url) continue;

		const text = String(m?.text || url).trim();
		const notionUrl = normalizeHttpUrl(m?.notionUrl);
		const key = `${url}|${text}|${notionUrl}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const item = { text, url };
		if (notionUrl) item.notionUrl = notionUrl;
		out.push(item);
	}

	return out;
}

function buildManualOverrideIndex(rows = []) {
	const byEditUrl = new Map();
	const byScheduleStudent = new Map();

	for (const row of rows) {
		if (!row || typeof row !== "object") continue;

		const editUrl = normalizeHttpUrl(row?.editUrl);
		const studentName = normalizeName(row?.studentName);
		const scheduleKey =
			row?.scheduleKey ||
			(row?.date && row?.time
				? scheduleKeyOf(row.date, normalizeTime(row.time))
				: null);

		const materials = makeMaterialList(
			Array.isArray(row?.materials) ? row.materials : [],
		);
		const lessonUrl = normalizeHttpUrl(row?.lessonUrl);
		if (lessonUrl) {
			materials.unshift({
				text: row?.lessonLabel || "振替授業URL",
				url: lessonUrl,
			});
		}

		const override = {
			materials: makeMaterialList(materials),
			pageUrl: normalizeHttpUrl(row?.pageUrl),
			lmsUrl: normalizeHttpUrl(row?.lmsUrl),
		};

		if (editUrl) byEditUrl.set(editUrl, override);
		if (scheduleKey && studentName) {
			byScheduleStudent.set(`${scheduleKey}|${studentName}`, override);
		}
	}

	return { byEditUrl, byScheduleStudent };
}

function resolveManualOverride(item, index) {
	const editUrls = Array.isArray(item?.editUrls) ? item.editUrls : [];
	for (const editUrl of editUrls) {
		const key = normalizeHttpUrl(editUrl);
		if (!key) continue;
		const found = index.byEditUrl.get(key);
		if (found) return found;
	}

	const scheduleStudentKey = makeOrphanDedupKey(item);
	return index.byScheduleStudent.get(scheduleStudentKey) || null;
}

function applyManualOverride(item, override) {
	if (!override) return item;

	const mergedMaterials = makeMaterialList([
		...(override.materials || []),
		...(Array.isArray(item?.materials) ? item.materials : []),
	]);

	return {
		...item,
		materials: mergedMaterials,
		pageUrl: item?.pageUrl || override.pageUrl || null,
		lmsUrl: item?.lmsUrl || override.lmsUrl || null,
	};
}

// =====================
// build
// =====================
export function buildOrphanVisualizerData() {
	if (!fs.existsSync(orphanJsonPath)) {
		console.error("❌ orphan json not found:", orphanJsonPath);
		process.exit(1);
	}

	const orphanLessons = loadJsonIfExists(orphanJsonPath, "orphan json");

	console.log("[DEBUG] orphanLessons length:", orphanLessons?.length);

	const lessonMap = buildLessonMap(orphanLessons);

	console.log("[DEBUG] lessonMap size:", lessonMap.size);

	const schedulesEnriched =
		loadJsonIfExists(schedulesEnrichedPath, "schedules_enriched.json") || [];
	// lmsUrl で schedules_enriched を引けるようにする
	const scheduleByLmsUrl = new Map(
		schedulesEnriched.filter((s) => s.lmsUrl).map((s) => [s.lmsUrl, s]),
	);

	const schedulesRaw =
		loadJsonIfExists(schedulesRawPath, "schedules.json") || [];

	const lessonsForSchedules =
		loadJsonIfExists(
			lessonsForSchedulesPath,
			"lms_lessons_for_schedules.json",
		) || [];
	const manualOrphanLessonsRaw =
		loadJsonIfExists(manualOrphanLessonsPath, "manual_orphan_lessons.json") || [];
	const manualOrphanOverrides = loadOptionalJsonArray(
		manualOrphanOverridesPath,
		"manual_orphan_overrides.json",
	);
	const manualOverrideIndex = buildManualOverrideIndex(manualOrphanOverrides);
	const { kept: manualOrphanLessons, removed: removedManualByAge } =
		pruneManualOrphanLessonsByAge(manualOrphanLessonsRaw);
	if (removedManualByAge.length > 0) {
		writeJson(manualOrphanLessonsPath, manualOrphanLessons);
		console.log(
			`🧹 manual_orphan_lessons: ${removedManualByAge.length} 件を期限切れ（${MANUAL_ORPHAN_RETENTION_MONTHS}か月以上前）で削除しました`,
		);
	}

	const absentIndex = buildAbsentIndex(lessonsForSchedules);
	const lessonByScheduleKey = new Map(
		lessonsForSchedules
			.filter((row) => row.scheduleKey)
			.map((row) => [row.scheduleKey, row]),
	);
	const registeredManualKeys = new Set([
		...buildRegisteredManualKeys(lessonsForSchedules),
		...buildRegisteredManualKeys(orphanLessons),
	]);

	// schedules.json 用の lookup map を作る
	const scheduleRawByCourseCount = new Map();
	const scheduleRawByScheduleKey = new Map();

	for (const s of schedulesRaw) {
		const key = `${s.course}__${s.count?.current}__${s.count?.total}`;
		if (!scheduleRawByCourseCount.has(key)) {
			scheduleRawByCourseCount.set(key, s);
		}
		const normalized = normalizeSchedule(s);
		if (normalized?.scheduleKey && !scheduleRawByScheduleKey.has(normalized.scheduleKey)) {
			scheduleRawByScheduleKey.set(normalized.scheduleKey, s);
		}
	}

	let visualizerData = Array.from(lessonMap.entries())
		.map(([scheduleKey, lessonInfo]) => {
			// ① orphan レコード
			const o = orphanLessons.find((l) => l.scheduleKey === scheduleKey);
			if (!o) return null;

			// ② schedules_enriched
			const base = scheduleByLmsUrl.get(o.lmsUrl);

			// ③ total
			const total = base?.count?.total ?? extractTotalFromLmsUrl(o.lmsUrl);

			// ④ raw schedule key
			const rawKey = `${base?.course ?? o.course}__${base?.count?.current}__${base?.count?.total}`;
			const rawScheduleByCourseCount = scheduleRawByCourseCount.get(rawKey);

			// ⑤ 振替元（不参加）を推測して付与
			const makeupOrigin = findMakeupOrigin(o, absentIndex);

			// count の揺れで rawKey が外れるケースがあるため、振替元 scheduleKey でも補完
			const rawScheduleFromOrigin = makeupOrigin?.scheduleKey
				? scheduleRawByScheduleKey.get(makeupOrigin.scheduleKey)
				: null;
			const rawSchedule = rawScheduleByCourseCount || rawScheduleFromOrigin;

			// ⑥ materials
			const materials = buildGoogleMaterialsFromScheduleRaw(rawSchedule);

			// ⑦ editUrls
			const editUrls =
				o.matchedLessons?.map((ml) => ml.editUrl).filter(Boolean) ?? [];

			return {
				scheduleKey: o.scheduleKey,
				date: o.date,
				time: o.time,

				month: base?.month ?? null,
				area: base?.area ?? null,
				course: base?.course ?? o.course ?? "(不明なコース)",
				category:
					base?.category ??
					base?.courseParts?.category ??
					rawSchedule?.courseParts?.category ??
					null,

				count: {
					raw: base?.count?.raw ?? `?/ ${total ?? "?"}`,
					current: base?.count?.current ?? null,
					total,
				},

				materials,
				pageUrl: rawSchedule?.pageUrl ?? null,

				lmsUrl: o.lmsUrl,
				editUrls, // ← ここで使える
				teacherNames: lessonInfo.teacherNames,
				makeupOrigin,
				studentName: o.matchedLessons?.[0]?.studentName ?? null,

				isOrphan: true,
				isManualPending: false,
			};
		})

		.filter(Boolean);

	const manualRows = Array.isArray(manualOrphanLessons)
		? manualOrphanLessons
		: [];
	const manualVisualizerData = manualRows
		.map((row, index) => {
			const date = row?.date;
			const time = normalizeTime(row?.time);
			const studentName = normalizeName(row?.studentName);

			if (!date || !time || !studentName) {
				console.warn(
					`⚠ skip manual orphan row[${index}] (date/time/studentName required)`,
				);
				return null;
			}

			const scheduleKey = row?.scheduleKey || scheduleKeyOf(date, time);
			const manualKey = `${scheduleKey}|${studentName}`;
			const isAutoPendingUnknown = isAutoPendingUnknownStudent(row, studentName);
			// auto 生成の「生徒未特定」仮行は、同コマに LMS 実データが来たら自動で非表示にする
			if (
				isAutoPendingUnknown &&
				(lessonByScheduleKey.has(scheduleKey) || lessonMap.has(scheduleKey))
			) {
				console.log(
					`ℹ skip auto manual pending (resolved by LMS slot): ${scheduleKey}`,
				);
				return null;
			}
			if (registeredManualKeys.has(manualKey)) {
				console.log(
					`ℹ skip manual orphan (already registered in LMS): ${manualKey}`,
				);
				return null;
			}
			const originScheduleKey =
				row?.originScheduleKey ||
				row?.makeupOrigin?.scheduleKey ||
				(row?.makeupOrigin?.date && row?.makeupOrigin?.time
					? scheduleKeyOf(
							row.makeupOrigin.date,
							normalizeTime(row.makeupOrigin.time),
						)
					: null);

			const originLesson = originScheduleKey
				? lessonByScheduleKey.get(originScheduleKey)
				: null;
			const lmsUrl = row?.lmsUrl || originLesson?.lmsUrl || null;
			const base = scheduleByLmsUrl.get(lmsUrl);

			const originMatchedByStudent =
				originLesson?.matchedLessons?.find(
					(m) => normalizeName(m.studentName) === studentName,
				) || null;
			const originAbsentByStudent =
				absentIndex.find(
					(a) =>
						a.scheduleKey === originScheduleKey &&
						normalizeName(a.studentName) === studentName,
				) || null;

			const rawCountLabel =
				row?.countLabel ||
				row?.makeupOrigin?.countLabel ||
				originMatchedByStudent?.countLabel ||
				originAbsentByStudent?.countLabel ||
				null;
			const total =
				row?.count?.total ?? base?.count?.total ?? extractTotalFromLmsUrl(lmsUrl);
			const current =
				row?.count?.current ?? parseCountLabelNumber(rawCountLabel) ?? null;
			const countRaw =
				row?.count?.raw ||
				(rawCountLabel && total ? `${rawCountLabel}/${total}回目` : null) ||
				"暫定振替";

			const inferredOrigin = {
				date:
					row?.makeupOrigin?.date ||
					originLesson?.date ||
					originAbsentByStudent?.date ||
					null,
				time: normalizeTime(
					row?.makeupOrigin?.time ||
						originLesson?.time ||
						originAbsentByStudent?.time ||
						"",
				),
				scheduleKey:
					row?.makeupOrigin?.scheduleKey || originScheduleKey || null,
				course:
					row?.makeupOrigin?.course ||
					originLesson?.course ||
					originAbsentByStudent?.course ||
					null,
				area:
					row?.makeupOrigin?.area ||
					originLesson?.area ||
					originAbsentByStudent?.area ||
					null,
				month:
					row?.makeupOrigin?.month ||
					originLesson?.month ||
					originAbsentByStudent?.month ||
					null,
				countLabel: rawCountLabel,
				studentName,
			};
			const makeupOrigin = inferredOrigin.date && inferredOrigin.time ? inferredOrigin : null;

			const rawSchedule =
				(originScheduleKey && scheduleRawByScheduleKey.get(originScheduleKey)) ||
				null;
			const autoMaterials = buildGoogleMaterialsFromScheduleRaw(rawSchedule);
			const manualMaterials = Array.isArray(row?.materials)
				? row.materials.filter((m) => m?.url)
				: [];
			const lessonLinkMaterial =
				row?.lessonUrl && /^https?:\/\//.test(row.lessonUrl)
					? [{ text: row.lessonLabel || "振替授業URL", url: row.lessonUrl }]
					: [];
			const materials = [...manualMaterials, ...lessonLinkMaterial, ...autoMaterials];

			return {
				scheduleKey,
				date,
				time,
				month: row?.month ?? base?.month ?? null,
				area: row?.area ?? base?.area ?? null,
				course:
					row?.course ||
					base?.course ||
					originLesson?.course ||
					"(手動振替)",
				category:
					row?.category ||
					base?.category ||
					base?.courseParts?.category ||
					null,
				count: {
					raw: countRaw,
					current,
					total,
				},
				materials,
				pageUrl: row?.pageUrl || null,
				lmsUrl,
				editUrls: Array.isArray(row?.editUrls) ? row.editUrls : [],
				teacherNames: [
					...new Set(
						[
							row?.teacherName,
							...(Array.isArray(row?.teacherNames) ? row.teacherNames : []),
							originMatchedByStudent?.teacherName,
						].filter(Boolean),
					),
				],
				makeupOrigin,
				studentName,
				isOrphan: true,
				isManualPending: true,
			};
		})
		.filter(Boolean);

	const realKeys = new Set(visualizerData.map(makeOrphanDedupKey));
	for (const manualItem of manualVisualizerData) {
		const key = makeOrphanDedupKey(manualItem);
		if (realKeys.has(key)) continue;
		realKeys.add(key);
		visualizerData.push(manualItem);
	}

	let appliedOverrideCount = 0;
	visualizerData = visualizerData.map((item) => {
		const override = resolveManualOverride(item, manualOverrideIndex);
		if (!override) return item;
		appliedOverrideCount += 1;
		return applyManualOverride(item, override);
	});
	if (appliedOverrideCount > 0) {
		console.log(
			`🧩 manual_orphan_overrides applied: ${appliedOverrideCount} 件`,
		);
	}

	visualizerData.sort((a, b) => {
		if (a.date === b.date) {
			return normalizeTime(a.time).localeCompare(normalizeTime(b.time));
		}
		return String(a.date).localeCompare(String(b.date));
	});

	visualizerData = addAttendanceCommentFlagOrphan(visualizerData, __dirname);

	const js = `
window.ORPHAN_VISUALIZER_DATA = ${JSON.stringify(visualizerData, null, 2)};
console.log("[DEBUG] ORPHAN_VISUALIZER_DATA isArray:", Array.isArray(window.ORPHAN_VISUALIZER_DATA));
`;

	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, js, "utf8");

	console.log("✅ orphan visualizer data written:");
	console.log(" ", outPath);
	console.log("  count:", visualizerData.length);
}

// direct run
if (import.meta.url === `file://${process.argv[1]}`) {
	buildOrphanVisualizerData();
}
