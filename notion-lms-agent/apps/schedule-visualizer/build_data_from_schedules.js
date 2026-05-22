// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/build_data_from_schedules.js
import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";
import {
	normalizeTime,
	scheduleKeyOf,
} from "../../modules/common/visualizer/lib/scheduleKey.js";

import { buildLessonMap } from "../../modules/common/visualizer/lib/buildLessonMap.js";
import { LMS_USER_GROUPS_URL } from "../../modules/lms/constants.js";

import { addAttendanceCommentFlag } from "./enrichers/add_attendance_comment_flag.js";
import { addStudentMilestones } from "./enrichers/add_student_milestones.js";
import { normalizeSchedule } from "../../modules/common/visualizer/lib/normalizeSchedule.js";

function parseCountNumber(label) {
	const m = String(label || "").match(/(\d+)回目/);
	return m ? Number(m[1]) : null;
}

export function buildVisualizerDataFromSchedules() {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	const schedulesPath = path.join(
		__dirname,
		"..",
		"..",
		"data",
		"schedules.json",
	);

	const schedulesPastPath = path.join(
		__dirname,
		"..",
		"..",
		"data",
		"schedules_past.json",
	);

	const coursesPath = path.join(
		__dirname,
		"..",
		"..",
		"data",
		"courses_with_group_ids.json",
	);

	const outPath = path.join(__dirname, "data", "data.js");
	const lmsLessonsPath = path.join(
		__dirname,
		"..",
		"..",
		"data",
		"lms_lessons_for_schedules.json",
	);

	const schedulesEnrichedPath = path.join(
		__dirname,
		"..",
		"..",
		"data",
		"schedules_enriched.json",
	);

	const lmsLessonsRaw = fs.readFileSync(lmsLessonsPath, "utf8");
	const lmsLessons = JSON.parse(lmsLessonsRaw);
	const furiganaByStudent = new Map();
	const studentCommentHistoryByCourse = new Map();
	for (const row of lmsLessons) {
		const courseName = String(row?.course || "").trim();
		const rowDate = String(row?.date || "").trim();
		const rowTime = normalizeTime(row?.time || "");
		for (const lesson of row?.matchedLessons || []) {
			const name = String(lesson?.studentName || "").trim();
			const furigana = String(lesson?.furigana || "").trim();
			if (!name) continue;
			if (furigana && !furiganaByStudent.has(name)) {
				furiganaByStudent.set(name, furigana);
			}

			const comment = String(lesson?.comment || "").trim();
			if (!courseName || !comment) continue;
			const histKey = `${courseName}__${name}`;
			if (!studentCommentHistoryByCourse.has(histKey)) {
				studentCommentHistoryByCourse.set(histKey, []);
			}
			studentCommentHistoryByCourse.get(histKey).push({
				date: rowDate,
				time: rowTime,
				countLabel: String(lesson?.countLabel || "").trim(),
				countNum: parseCountNumber(lesson?.countLabel),
				comment,
			});
		}
	}
	for (const history of studentCommentHistoryByCourse.values()) {
		history.sort((a, b) => {
			const keyA = `${a.date || ""} ${a.time || ""}`;
			const keyB = `${b.date || ""} ${b.time || ""}`;
			return keyA.localeCompare(keyB);
		});
	}

	const lessonMap = buildLessonMap(lmsLessons);
	const schedulesEnrichedRaw = fs.readFileSync(schedulesEnrichedPath, "utf8");
	const schedulesEnriched = JSON.parse(schedulesEnrichedRaw);
	const targetTeacher = (process.env.NAME || "").trim();

	// scheduleKey -> enriched row の Map
	const enrichedMap = new Map(
		schedulesEnriched
			.filter((e) => e.scheduleKey)
			.map((e) => [e.scheduleKey, e]),
	);

	for (const [k] of enrichedMap.entries()) {
		console.log("[ENRICHED MAP KEY]", k);
		break;
	}

	// courses_with_group_ids.json を読み込んで、courseKey → courseInfo のマップを作る
	let courseMap = new Map();
	if (fs.existsSync(coursesPath)) {
		const rawCourses = fs.readFileSync(coursesPath, "utf8");
		const courses = JSON.parse(rawCourses);
		courseMap = new Map(courses.map((c) => [c.courseKey, c]));
	} else {
		console.warn(`⚠ Not found: ${coursesPath}`);
	}

	// Notion系やナビゲーション系は除外して「教材リンク」だけを抽出
	function extractMaterials(entry) {
		const links = (entry.detail && entry.detail.links) || [];

		return links.filter((link) => {
			const text = link.text || "";
			const url = link.url || "";

			// 1) Notion のページ系は除外
			try {
				const u = new URL(url);
				if (u.hostname.includes("notion.site")) return false;
			} catch (e) {
				// URL パース失敗 → 一旦残す
			}

			// 2) ナビゲーション系っぽい文言は除外
			if (text.includes("アサイン")) return false;
			if (text.includes("コンテンツにスキップ")) return false;
			if (text.includes("Skip to content")) return false;

			return true;
		});
	}

	// LMS の出欠URLを作る
	function buildLmsUrl(entry) {
		const courseKey = entry.course; // "07月千葉マーケ" 等
		const courseInfo = courseMap.get(courseKey);
		if (!courseInfo) return null;

		const groupIds = courseInfo.userGroupIds || [];
		if (!groupIds.length) return null;

		const groupId = groupIds[groupIds.length - 1];
		const total = entry.count && entry.count.total;
		if (!groupId || !total) return null;

		return `${LMS_USER_GROUPS_URL}/${groupId}?number_of_times=${total}`;
	}

	function loadSchedules(filePath, { allowEmpty = false } = {}) {
		if (!fs.existsSync(filePath)) {
			console.warn(`⚠ Not found: ${filePath}`);
			return [];
		}

		const raw = fs.readFileSync(filePath, "utf8").trim();

		if (!raw) {
			if (allowEmpty) {
				console.log(`ℹ empty but allowed: ${filePath}`);
				return [];
			}
			console.warn(`⚠ empty json, skip: ${filePath}`);
			return [];
		}

		try {
			return JSON.parse(raw);
		} catch (e) {
			console.warn(`⚠ failed to parse json, skip: ${filePath}`);
			return [];
		}
	}

	// 未来（schedules.json） + 過去（schedules_past.json）を結合
	const allRaw = loadSchedules(schedulesPath);
	// 今回は past を使わないなら、そもそも読まない
	// const pastRaw = loadSchedules(schedulesPastPath, { allowEmpty: true });

	const all = allRaw
		.map(normalizeSchedule)
		.filter(Boolean)
		.map((item) => {
			const enriched = schedulesEnriched.find(
				(e) =>
					e.date === item.date &&
					normalizeTime(e.time) === normalizeTime(item.time) &&
					e.course === item.course &&
					e.area === item.area,
			);

			const scheduleKey =
				enriched?.scheduleKey ??
				scheduleKeyOf(item.date, normalizeTime(item.time));
			const lesson = scheduleKey ? lessonMap.get(scheduleKey) : null;
			let teacherNames = [];
			let editUrls = [];
			let slotStudents = [];
			let slotStudentHistories = [];
			let teacherStatus = lesson?.teacherStatus ?? null;

			if (lesson?.matchedLessons) {
				const targetTime = normalizeTime(item.time); // "15:00"

				const startMatched = lesson.matchedLessons.filter(
					(l) => normalizeTime(l.start) === targetTime,
				);
				const endMatched = lesson.matchedLessons.filter(
					(l) => normalizeTime(l.end) === targetTime,
				);
				const filteredLessons = startMatched.length ? startMatched : endMatched;

				teacherNames = [
					...new Set(
						filteredLessons
							.map((l) => l.teacherName)
							.filter(Boolean)
							.map((n) => n.trim()),
					),
				];

				editUrls = [
					...new Set(filteredLessons.map((l) => l.editUrl).filter(Boolean)),
				];

				const slotStudentsByName = new Map();
				for (const lesson of filteredLessons) {
					const name = String(lesson?.studentName || "").trim();
					if (!name) continue;

					const direct = String(lesson?.furigana || "").trim();
					const fallback = furiganaByStudent.get(name) || "";
					const furigana = direct || fallback;

					const existing = slotStudentsByName.get(name);
					// 同名が複数行ある場合は、ふりがなが埋まっている方を優先する
					if (!existing || (!existing.furigana && furigana)) {
						slotStudentsByName.set(name, { name, furigana });
					}
					}
					slotStudents = [...slotStudentsByName.values()];
					slotStudentHistories = slotStudents.map((student) => {
						const key = `${item.course}__${student.name}`;
						const history = studentCommentHistoryByCourse.get(key) || [];
						const filtered = history.filter((h) => String(h.comment || "").trim());
						return {
							name: student.name,
							furigana: student.furigana || "",
							comments: filtered,
						};
					});

				// 画面表示は「対象時刻に一致したレッスン」基準で判定する
				if (!filteredLessons.length) {
					teacherStatus = "no_row";
				} else if (!teacherNames.length) {
					teacherStatus = "missing";
				} else if (targetTeacher) {
					teacherStatus = teacherNames.some((tn) => tn === targetTeacher)
						? "matched"
						: "different";
				}
			}

			if (lesson) {
				console.log("[LESSON MAP HIT]", scheduleKey);
			}
			if (lesson && !lesson.scheduleEditUrl) {
				console.log("[LESSON STRUCTURE]", lesson);
			}
			if (lesson && scheduleKey === "2026-01-26T13:00") {
				console.log("[LESSON FULL DUMP]", JSON.stringify(lesson, null, 2));
			}

			return {
				...item,
				scheduleKey,
				lmsUrl: enriched?.lmsUrl ?? null,
				teacherStatus,
				teacherNames,
				editUrls,
				slotStudents,
				slotStudentHistories,
			};
		});

	// 今日 00:00（ローカル）
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// 明日 00:00
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);

	const mine = [];
	const past = [];

	for (const item of all) {
		const dt = new Date(`${item.date}T${item.time.padStart(5, "0")}:00`);

		if (dt < today) {
			// 今日より前 → past
			past.push({ ...item, type: "past" });
		} else {
			// 今日以降（今日・未来）→ mine
			mine.push({ ...item, type: "mine" });
		}
	}

	// ソートしておくと見やすい（任意）
	mine.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
	past.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

	const visData = {
		available: [],
		mine,
		past,
	};

	const enrichedVisData = addAttendanceCommentFlag(visData, __dirname);
	const milestoneEnriched = addStudentMilestones(enrichedVisData, __dirname);

	const jsContent =
		"window.VISUALIZER_DATA = " +
		JSON.stringify(milestoneEnriched, null, 2) +
		";\n";
	fs.writeFileSync(outPath, jsContent, "utf8");

	console.log("✅ Generated:", outPath);
	console.log(
		"  from:",
		schedulesPath,
		"and",
		schedulesPastPath,
		"and",
		coursesPath,
	);
	console.log("  mine count:", mine.length);
	console.log("  past count:", past.length);
}

// 直接実行された場合用
if (import.meta.url === `file://${process.argv[1]}`) {
	buildVisualizerDataFromSchedules();
}
