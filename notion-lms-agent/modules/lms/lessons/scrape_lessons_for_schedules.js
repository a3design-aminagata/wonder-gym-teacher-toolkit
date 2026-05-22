// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/lms/lessons/scrape_lessons_for_schedules.js
/**
 * schedules_enriched.json を入力として、
 * LMS の user_groups/:id?number_of_times=xx の table から
 * 「日時が一致する行だけ」抽出し、data/lms_lessons_for_schedules.json を生成する。
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { launchBrowser } from "../../common/browser.js";
import { wait } from "../../common/wait.js";
import { loginLms } from "../auth/loginLms.js";
import { extractLmsTable } from "./parts/extractLmsTable.js";
import { patchLessonsByEditUrl } from "./parts/patchLessonsByEditUrl.js";
import { saveWithMode } from "./parts/saveWithMode.js";
import dotenv from "dotenv";

console.log("=== scrape_lessons_for_schedules.js START ===");
console.log("[ARGV]", process.argv);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ROOT = notion-lms-agent/
const ROOT = path.resolve(__dirname, "..", "..", "..");
dotenv.config({
	path: path.join(ROOT, ".env"),
});
console.log("[ENV NAME]", process.env.NAME);

const dataDir = path.join(ROOT, "data");
const inPath = path.join(dataDir, "schedules_enriched.json");
const outPath = path.join(dataDir, "lms_lessons_for_schedules.json");

const coursesPath = path.join(dataDir, "courses_with_group_ids.json");
const courseMap = new Map();
if (fs.existsSync(coursesPath)) {
	const courses = JSON.parse(fs.readFileSync(coursesPath, "utf8"));
	courses.forEach((c) => courseMap.set(c.courseKey, c));
}

// data/ が無いと write で落ちるので念のため作る
fs.mkdirSync(dataDir, { recursive: true });

function readJson(p) {
	if (!fs.existsSync(p)) return [];
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
	fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// "2025年12月15日(月) 09:00 ~ 10:00" -> { date:"2025-12-15", start:"09:00", end:"10:00" }
function parseLmsDatetime(text) {
	const t = (text || "").trim();
	const m = t.match(
		/(\d{4})年(\d{2})月(\d{2})日.*?(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/,
	);
	if (!m) return null;
	const yyyy = m[1];
	const mm = m[2];
	const dd = m[3];
	return {
		date: `${yyyy}-${mm}-${dd}`,
		start: m[4],
		end: m[5],
	};
}

function textOf(el) {
	return (el?.textContent || "").trim();
}

function normalizeTime(t) {
	// "9:00" -> "09:00" も一応吸収
	const m = String(t || "")
		.trim()
		.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return String(t || "").trim();
	return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function keyOf(date, time) {
	return `${date}T${normalizeTime(time)}`;
}

/**
 * exports
 */
export async function scrapeLmsLessonsForSchedules(mode = "today") {
	console.log("[SCRAPE MODE]", mode);
	const targetTeacher = (process.env.NAME || "").trim();
	if (!targetTeacher) {
		console.warn("⚠ process.env.NAME が空です（講師一致判定が弱くなります）");
	}

	const rawSchedules = readJson(inPath);

	console.log(
		"[DEBUG] RAW schedules:",
		rawSchedules.map((s) => ({
			course: s.course,
			area: s.area,
			date: s.date,
			time: s.time,
			lmsUrl: s.lmsUrl,
		})),
	);

	const schedulesAll = rawSchedules.filter(
		(x) => x?.lmsUrl && x?.date && x?.time,
	);

	console.log(
		"[DEBUG] FILTERED schedules:",
		schedulesAll.map((s) => ({
			course: s.course,
			area: s.area,
			date: s.date,
			time: s.time,
			lmsUrl: s.lmsUrl,
		})),
	);

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	let schedules;

	if (mode === "today") {
		schedules = schedulesAll.filter((s) => {
			const d = new Date(s.date);
			d.setHours(0, 0, 0, 0);
			return d.getTime() === today.getTime();
		});
	} else if (mode === "week") {
		const start = new Date(today);
		start.setDate(today.getDate() - 7);
		start.setHours(0, 0, 0, 0);

		const end = new Date(today);
		end.setDate(today.getDate() + 7);
		end.setHours(23, 59, 59, 999);

		schedules = schedulesAll.filter((s) => {
			const d = new Date(s.date);
			d.setHours(0, 0, 0, 0);
			return d >= start && d <= end;
		});
	} else if (mode === "all") {
		schedules = schedulesAll;
	} else {
		throw new Error(`Unknown mode: ${mode}`);
	}

	console.log("schedules target:", schedules.length);

	// lmsUrl をユニーク化（同じ user_group を複数 schedule が参照するため）
	const urlSet = new Set(schedules.map((s) => s.lmsUrl));
	const lmsUrls = Array.from(urlSet);

	const browser = await launchBrowser();
	const page = await browser.newPage();

	// 既存 loginLms を呼ぶ（必要に応じて loginLms.js の実装に合わせてください）
	await loginLms(page);

	// lmsUrl -> rows
	const lmsRowsByUrl = {};

	for (const url of lmsUrls) {
		console.log("🔎 LMS:", url);

		await page.goto(url, { waitUntil: "networkidle2" });
		console.log("SCHEDULE OPEN URL:", page.url());
		await wait(400);

		const rows = await extractLmsTable(page);
		lmsRowsByUrl[url] = rows;
		console.log("  rows:", rows.length);
	}

	// schedule 単位に “日時一致だけ” ぶら下げる
	const out = schedules.map((s) => {
		const rows = lmsRowsByUrl[s.lmsUrl] || [];
		const k = keyOf(s.date, s.time);

		const matchedByStart = rows.filter((r) => keyOf(r.date, r.start) === k);
		const matchedByEnd = rows.filter((r) => keyOf(r.date, r.end) === k);
		// 基本は「開始時刻一致」を採用し、見つからない時だけ終了時刻一致にフォールバック
		const matched = matchedByStart.length ? matchedByStart : matchedByEnd;
		const scheduleEditUrl = matched.find((m) => m.editUrl)?.editUrl ?? null;
		// 講師名の一致/未登録判定（セッション単位で見るため、matched 内の teacherName を総合）
		const teacherNames = Array.from(
			new Set(matched.map((m) => (m.teacherName || "").trim()).filter(Boolean)),
		);
		const hasTeacher = teacherNames.length > 0;
		const isTeacherMatched =
			targetTeacher && teacherNames.some((tn) => tn === targetTeacher);

		let teacherStatus = "unknown";
		if (!matched.length) teacherStatus = "no_row";
		else if (!hasTeacher) teacherStatus = "missing";
		else if (isTeacherMatched) teacherStatus = "matched";
		else teacherStatus = "different";
		const courseInfo = courseMap.get(s.course); // courses_with_group_ids.json から情報を取得
		const groupIds = courseInfo?.userGroupIds || []; // userGroupIds 配列
		const groupId = groupIds[groupIds.length - 1]; // 最後のIDを選ぶ
		const totalTimes = matched.length || 0; // LMSに渡す回数（optional）

		return {
			scheduleKey: k,
			date: s.date,
			time: normalizeTime(s.time),
			course: s.course,
			area: s.area,
			month: s.month,
			lmsUrl: s.lmsUrl,
			scheduleEditUrl,
			teacherStatus,
			teacherNames,
			matchedLessons: matched.map((m) => ({
				isMakeup: m.isMakeup,
				countLabel: m.countLabel,
				start: m.start,
				end: m.end,
				teacherName: m.teacherName,
				lessonUrl: m.lessonUrl,
				editUrl: m.editUrl,
				studentName: m.studentName,
				furigana: m.furigana,
				attendance: m.attendance,
				motivation: m.motivation,
				progress: m.progress,
				comment: m.comment,
			})),
		};
	});
	console.log(
		"[DEBUG] matchedLessons total:",
		out.reduce((sum, o) => sum + o.matchedLessons.length, 0),
	);

	console.log(
		"[DEBUG] comments filled:",
		out
			.flatMap((o) => o.matchedLessons)
			.filter((m) => typeof m.comment === "string" && m.comment.trim() !== "")
			.length,
	);
	if (mode === "all") {
		// all は source of truth をそのまま保存
		writeJson(outPath, out);
		console.log("✅ saved (regenerated):", outPath);
	} else {
		// today / week は patch
		saveWithMode({
			mode,
			outPath,
			out,
			patchFn: patchLessonsByEditUrl,
		});
	}

	await page.close();
	await browser.close();
}
async function main() {
	const mode = process.argv[2] || "all";
	console.log("[MODE]", mode);

	await scrapeLmsLessonsForSchedules(mode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error("❌ scrape_lessons_for_schedules failed");
		console.error(err);
		process.exit(1);
	});
}
