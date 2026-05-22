// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/lms/lessons/scrape_lessons_for_teacher.js
/**
 * 講師（process.env.NAME）に紐づく LMS レッスンをすべて取得し、
 * schedules_enriched.json と照合して
 * - 正規スケジュール分
 * - orphan（振替・臨時・ズレ）
 * に分けて JSON 出力する
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { launchBrowser } from "../../common/browser.js";
import { wait } from "../../common/wait.js";
import { loginLms } from "../auth/loginLms.js";
import { saveWithMode } from "./parts/saveWithMode.js";
import { patchByScheduleKey } from "./parts/patchByScheduleKey.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..", "..");

const dataDir = path.join(ROOT, "data");
const schedulesPath = path.join(dataDir, "schedules_enriched.json");
const outSchedulesPath = path.join(dataDir, "lms_lessons_for_schedules.json");
const outOrphanPath = path.join(dataDir, "lms_lessons_orphan.json");

fs.mkdirSync(dataDir, { recursive: true });

function readJson(p) {
	if (!fs.existsSync(p)) return [];
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
	fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function normalizeTime(t) {
	const m = String(t || "")
		.trim()
		.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return String(t || "").trim();
	return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function keyOf(date, start) {
	return `${date}T${normalizeTime(start)}`;
}

function isTargetDate(date, mode) {
	if (mode === "all") return true;

	const d = new Date(date);
	d.setHours(0, 0, 0, 0);

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (mode === "today") {
		return d.getTime() === today.getTime();
	}

	if (mode === "week") {
		const start = new Date(today);
		start.setDate(today.getDate() - 7);
		start.setHours(0, 0, 0, 0);

		const end = new Date(today);
		end.setDate(today.getDate() + 7);
		end.setHours(23, 59, 59, 999);

		return d >= start && d <= end;
	}

	return true;
}
function groupByScheduleKey(items) {
	const map = new Map();

	for (const l of items) {
		if (!map.has(l.scheduleKey)) {
			map.set(l.scheduleKey, {
				scheduleKey: l.scheduleKey,
				date: l.date,
				time: l.start,
				course: l.course,
				area: "",
				month: new Date(l.date).getMonth() + 1,
				lmsUrl: l.lmsUrl,
				teacherStatus: "matched",
				teacherNames: [l.teacherName],
				matchedLessons: [],
			});
		}

		map.get(l.scheduleKey).matchedLessons.push({
			isMakeup: l.isMakeup,
			countLabel: l.countLabel,
			start: l.start,
			end: l.end,
			teacherName: l.teacherName,
			lessonUrl: l.lessonUrl,
			editUrl: l.editUrl,
			studentName: l.studentName,
			attendance: l.attendance,
			motivation: l.motivation,
			progress: l.progress,
			comment: l.comment,
		});
	}

	return Array.from(map.values());
}

/**
 * LMS テーブルをすべて走査して行を抽出
 */
async function extractAllLmsRows(page) {
	return await page.evaluate(() => {
		const table = document.querySelector("table.text-center");
		if (!table) return [];

		const trs = Array.from(table.querySelectorAll("tbody tr"));
		const rows = [];

		let current = {};

		function text(el) {
			return (el?.textContent || "").trim();
		}
		function valueOf(el) {
			if (!el) return "";
			if (el.tagName === "SELECT") {
				const selectedText = (el.selectedOptions?.[0]?.textContent || "").trim();
				return selectedText || el.value || "";
			}
			if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
				return el.value || "";
			}
			return (el.textContent || "").trim();
		}
		function cellValue(td) {
			if (!td) return "";
			const formEl = td.querySelector("textarea, select, input:not([type='hidden'])");
			if (formEl) return valueOf(formEl).trim();
			return text(td);
		}

		function parseDt(t) {
			const m = t.match(
				/(\d{4})年(\d{2})月(\d{2})日.*?(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/,
			);
			if (!m) return null;
			return {
				date: `${m[1]}-${m[2]}-${m[3]}`,
				start: m[4],
				end: m[5],
			};
		}

		for (const tr of trs) {
			const tds = tr.querySelectorAll("td");

			const dtText = text(tds[3]);
			const parsed = dtText ? parseDt(dtText) : null;
			console.log("---- ROW ----");
			console.log("dtText:", dtText);
			console.log("parsed:", parsed);
			console.log("student:", text(tds[6]));
			console.log("isMakeup:", text(tds[1]));
			if (parsed) {
				current = {
					...parsed,
					isMakeup: text(tds[1]) === "振替",
					countLabel: text(tds[2]),
					teacherName: text(tds[4]),
					lessonUrl: tds[5]?.querySelector("a")?.href || "",
					// ★ 追加：▶ 編集URL
					editUrl:
						Array.from(tds)
							.map((td) => td.querySelector('a[href*="/online_lessons/"]'))
							.find(Boolean)?.href || "",
				};
			}

			const studentName = text(tds[6]);
			if (!studentName) continue;

			rows.push({
				...current,
				studentName,
				attendance: cellValue(tds[8]),
				motivation: cellValue(tds[9]),
				progress: cellValue(tds[10]),
				comment: cellValue(tds[11]),
			});
		}

		return rows;
	});
}

/**
 * メイン
 */
export async function scrapeLessonsForTeacher(
	mode = "all",
	{ writeSchedules = true, writeOrphan = true } = {},
) {
	console.log("[MODE]", mode);
	const teacherName = (process.env.NAME || "").trim();
	if (!teacherName) {
		throw new Error("process.env.NAME が未設定です");
	}

	console.log("👤 target teacher:", teacherName);

	const schedules = readJson(schedulesPath);
	const existingSchedules = readJson(outSchedulesPath);
	const existingOrphan = readJson(outOrphanPath);

	const targetSchedules =
		mode === "all"
			? schedules
			: schedules.filter((s) => isTargetDate(s.date, mode));

	// lmsUrl → course の対応表
	const lmsUrlToCourse = new Map();

	for (const s of schedules) {
		if (!s.lmsUrl) continue;
		if (!lmsUrlToCourse.has(s.lmsUrl)) {
			lmsUrlToCourse.set(s.lmsUrl, s.course || "");
		}
	}

	const scheduleKeySet = new Set(schedules.map((s) => keyOf(s.date, s.time)));

	const lmsUrls = Array.from(
		new Set(targetSchedules.map((s) => s.lmsUrl).filter(Boolean)),
	);

	const browser = await launchBrowser();
	const page = await browser.newPage();

	await loginLms(page);

	const allLessons = [];

	for (const url of lmsUrls) {
		console.log("🔎 LMS:", url);
		await page.goto(url, { waitUntil: "networkidle2" });
		console.log("ORPHAN OPEN URL:", page.url());
		await wait(500);

		const rows = await extractAllLmsRows(page);
		console.log("  rows:", rows.length);

		const course = lmsUrlToCourse.get(url) || "";

		allLessons.push(
			...rows
				.filter((r) => r.teacherName === teacherName)
				.filter((r) => isTargetDate(r.date, mode))
				.map((r) => ({
					...r,
					lmsUrl: url,
					course,
				})),
		);
	}
	function lessonKey(editUrl, studentName) {
		return `${editUrl}__${studentName}`;
	}
	function buildLessonMap(grouped) {
		const map = new Map();

		for (const g of grouped) {
			for (const l of g.matchedLessons || []) {
				if (l.editUrl && l.studentName) {
					map.set(lessonKey(l.editUrl, l.studentName), l);
				}
			}
		}

		return map;
	}

	const existingLessonMap = new Map([
		...buildLessonMap(existingSchedules),
		...buildLessonMap(existingOrphan),
	]);

	const patchedLessons = [];

	for (const lesson of allLessons) {
		const key = lessonKey(lesson.editUrl, lesson.studentName);
		const prev = existingLessonMap.get(key);

		if (prev) {
			patchedLessons.push({
				...prev, // ← 既存の attendance / motivation / progress / comment
				...lesson, // ← LMS から取った最新データ
				scheduleKey: keyOf(lesson.date, lesson.start),
			});
		} else {
			patchedLessons.push({
				...lesson,
				scheduleKey: keyOf(lesson.date, lesson.start),
			});
		}
	}

	const forSchedules = [];
	const orphan = [];

	for (const lesson of patchedLessons) {
		if (scheduleKeySet.has(lesson.scheduleKey)) {
			forSchedules.push(lesson);
		} else {
			orphan.push(lesson);
		}
	}
	// --- schedules ---
	if (writeSchedules) {
		saveWithMode({
			mode,
			outPath: outSchedulesPath,
			out: groupByScheduleKey(forSchedules),
			patchFn: patchByScheduleKey,
		});
	} else {
		console.log("ℹ skip writing schedules (writeSchedules=false)");
	}

	// --- orphan ---
	if (writeOrphan) {
		saveWithMode({
			mode,
			outPath: outOrphanPath,
			out: groupByScheduleKey(orphan),
			patchFn: patchByScheduleKey,
		});
	} else {
		console.log("ℹ skip writing orphan (writeOrphan=false)");
	}

	console.log("✅ written:");
	console.log("  schedules:", forSchedules.length);
	console.log("  orphan   :", orphan.length);

	await browser.close();
}
// --- CLI 実行用エントリポイント ---
if (import.meta.url === `file://${process.argv[1]}`) {
	const mode = process.argv[2] || "all";

	scrapeLessonsForTeacher(mode).catch((err) => {
		console.error("❌ scrapeLessonsForTeacher failed");
		console.error(err);
		process.exit(1);
	});
}
