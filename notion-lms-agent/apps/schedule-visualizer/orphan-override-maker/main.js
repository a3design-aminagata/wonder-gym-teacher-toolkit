// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/orphan-override-maker/main.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { launchBrowser } from "../../../modules/common/browser.js";
import { wait } from "../../../modules/common/wait.js";
import { extractDetailPage } from "../../../modules/notion/internal/actions/notionActions.js";
import { NOTION_VIEW_URL } from "../../../modules/notion/scrape/schedule/constants.js";
import { buildOrphanVisualizerData } from "../build_orphan_visualizer_data.js";
import { buildSubstituteData } from "../build_substitute_data.js";
import { LMS_BASE_URL } from "../../../modules/lms/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..", "..", "..");
const WORK_DIR = path.join(__dirname, "work");
const INPUT_PATH = path.join(WORK_DIR, "input.txt");
const LAST_RESULT_PATH = path.join(WORK_DIR, "last_result.json");
const OVERRIDES_PATH = path.join(ROOT, "data", "manual_orphan_overrides.json");
const MANUAL_LESSONS_PATH = path.join(ROOT, "data", "manual_orphan_lessons.json");
const AUTO_PENDING_STUDENT_NAME = "生徒未特定（自動）";
const AUTO_PENDING_NOTE = "LMS登録前の暫定表示";
const AUTO_PENDING_LESSON_URL = normalizeUrl(process.env.AUTO_PENDING_LESSON_URL || "");
const LMS_HOST_PATTERN = (() => {
	try {
		return new URL(LMS_BASE_URL).hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	} catch {
		return "wonder-gym\\.jp";
	}
})();

if (!AUTO_PENDING_LESSON_URL) {
	console.warn(
		"ℹ AUTO_PENDING_LESSON_URL が未設定のため、manual_orphan_lessons の lessonUrl は空で保存されます",
	);
}

function normalizeTime(value) {
	const m = String(value || "")
		.trim()
		.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return "";
	return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function scheduleKeyOf(date, time) {
	return `${date}T${time}`;
}

function normalizeUrl(url) {
	const v = String(url || "").trim();
	if (!/^https?:\/\//.test(v)) return "";
	return v.replace(/\/+$/, "");
}

function parseDateTime(text) {
	const patterns = [
		/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日[^\d]*(\d{1,2}:\d{2})\s*[～~\-]\s*(\d{1,2}:\d{2})/,
		/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[^\d]*(\d{1,2}:\d{2})\s*[～~\-]\s*(\d{1,2}:\d{2})/,
	];

	for (const p of patterns) {
		const m = text.match(p);
		if (!m) continue;

		const y = Number(m[1]);
		const mo = Number(m[2]);
		const d = Number(m[3]);
		const start = normalizeTime(m[4]);
		const end = normalizeTime(m[5]);
		const date = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(
			d,
		).padStart(2, "0")}`;

		if (!start) continue;
		return { date, start, end: end || null };
	}

	return null;
}

function parseCourseLine(text) {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	const line =
		lines.find((l) => /【.+?】/.test(l) && /開講/.test(l) && /回目/.test(l)) || "";
	if (!line) return null;

	const area = line.match(/【([^】]+)】/)?.[1] || null;
	const opened = line.match(/(\d{4})年(\d{1,2})月開講/);
	const count = line.match(/(\d+)\s*回目/);

	return {
		raw: line,
		area,
		openYear: opened ? Number(opened[1]) : null,
		openMonth: opened ? Number(opened[2]) : null,
		countCurrent: count ? Number(count[1]) : null,
	};
}

function parseRequesterName(text) {
	const firstLine = String(text || "")
		.split(/\r?\n/)
		.map((l) => l.trim())
		.find(Boolean);
	if (!firstLine) return null;

	const withoutTime = firstLine.replace(/\s*\[\d{1,2}:\d{2}\]\s*$/, "").trim();
	const name = withoutTime.split("/")[0]?.trim() || "";
	return name || null;
}

function parseInputMessage(text) {
	const lmsEditUrlPattern = new RegExp(
		`https?:\\/\\/${LMS_HOST_PATTERN}\\/lecturer-portal\\/online-lesson-attendances\\/online_lessons\\/\\d+\\/edit`,
		"iu",
	);
	const lmsEditUrl =
		text.match(lmsEditUrlPattern)?.[0] || "";
	if (!lmsEditUrl) {
		throw new Error("LMS edit URL が見つかりませんでした（.../online_lessons/{id}/edit）");
	}

	const notionUrl =
		text.match(/https?:\/\/[^\s]*notion\.(?:site|so)\/[^\s)」】]*/iu)?.[0] || "";

	const dateTime = parseDateTime(text);
	if (!dateTime) {
		throw new Error("日時が見つかりませんでした（例: 2026年5月16日 (土) 12:00～13:00）");
	}

	const course = parseCourseLine(text);
	const scheduleKey = scheduleKeyOf(dateTime.date, dateTime.start);

	return {
		lmsEditUrl: normalizeUrl(lmsEditUrl),
		notionUrl: normalizeUrl(notionUrl),
		date: dateTime.date,
		startTime: dateTime.start,
		endTime: dateTime.end,
		scheduleKey,
		course,
		requesterName: parseRequesterName(text),
	};
}

function extractMaterialsFromDetail(detail, pageUrl) {
	const rawLinks = Array.isArray(detail?.links) ? detail.links : [];
	const seen = new Set();
	const links = [];

	for (const link of rawLinks) {
		const url = normalizeUrl(link?.url);
		if (!url) continue;

		try {
			const u = new URL(url);
			if (u.hostname.includes("notion.site") || u.hostname.includes("notion.so")) continue;
		} catch {
			continue;
		}

		const text = String(link?.text || "").trim();
		if (!text) continue;
		if (text.includes("アサイン")) continue;
		if (text.includes("コンテンツにスキップ")) continue;
		if (text.includes("Skip to content")) continue;

		const key = `${text}|${url}`;
		if (seen.has(key)) continue;
		seen.add(key);

		links.push({
			text,
			url,
			notionUrl: pageUrl,
		});
	}

	return links;
}

const TARGET_NOTION_HOST = String(
	process.env.NOTION_WORKSPACE_HOST || "YOUR_NOTION_WORKSPACE.notion.site",
)
	.trim()
	.toLowerCase();

function isNotionWorkspaceUrl(url) {
	try {
		const u = new URL(url);
		const host = u.hostname.toLowerCase();
		if (
			!TARGET_NOTION_HOST ||
			TARGET_NOTION_HOST.includes("YOUR_NOTION_WORKSPACE")
		) {
			return host.endsWith("notion.site") || host.endsWith("notion.so");
		}
		return host === TARGET_NOTION_HOST;
	} catch {
		return false;
	}
}

async function scrapeNotionPage(notionUrl) {
	let browser = null;
	let page = null;
	try {
		browser = await launchBrowser();
		page = await browser.newPage();
		// schedules.json と同じ経路で表示コンテキストを作ってから詳細ページを開く
		await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
		await wait(1200);
		const detail = await extractDetailPage(page, notionUrl);
		const pageUrl = normalizeUrl(detail?.pageUrl || notionUrl);
		const materials = extractMaterialsFromDetail(detail, pageUrl);
		const normalizedDetail =
			detail && typeof detail === "object"
				? {
						...detail,
						pageUrl,
					}
				: null;
		return { pageUrl, materials, detail: normalizedDetail };
	} finally {
		if (page) await page.close().catch(() => {});
		if (browser) await browser.close().catch(() => {});
	}
}

function readJsonArray(filePath) {
	if (!fs.existsSync(filePath)) return [];
	try {
		const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function uniqMaterials(materials = []) {
	const seen = new Set();
	const out = [];
	for (const m of materials) {
		const text = String(m?.text || "").trim();
		const url = normalizeUrl(m?.url);
		if (!text || !url) continue;
		const notionUrl = normalizeUrl(m?.notionUrl);
		const key = `${text}|${url}|${notionUrl}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const row = { text, url };
		if (notionUrl) row.notionUrl = notionUrl;
		out.push(row);
	}
	return out;
}

function upsertOverride(existingRows, entry) {
	const key = normalizeUrl(entry.editUrl);
	if (!key) throw new Error("override entry の editUrl が不正です");

	const now = new Date().toISOString();
	const next = Array.isArray(existingRows) ? [...existingRows] : [];
	const index = next.findIndex((row) => normalizeUrl(row?.editUrl) === key);

	if (index < 0) {
		next.push({
			...entry,
			materials: uniqMaterials(entry.materials || []),
			createdAt: now,
			updatedAt: now,
		});
		return { rows: next, action: "created" };
	}

	const prev = next[index];
	next[index] = {
		...prev,
		...entry,
		materials: uniqMaterials([...(entry.materials || []), ...(prev.materials || [])]),
		createdAt: prev.createdAt || now,
		updatedAt: now,
	};
	return { rows: next, action: "updated" };
}

function normalizeDate(date) {
	const m = String(date || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function normalizeManualStudentName(value) {
	return String(value || "").trim();
}

function isAutoManualRow(row) {
	return (
		String(row?.source || "").trim() === "orphan-override-maker" &&
		normalizeManualStudentName(row?.studentName) === AUTO_PENDING_STUDENT_NAME
	);
}

function upsertManualPendingLesson(existingRows, entry) {
	const key = normalizeUrl(entry?.sourceEditUrl);
	if (!key) throw new Error("manual pending entry の sourceEditUrl が不正です");

	const now = new Date().toISOString();
	const next = Array.isArray(existingRows) ? [...existingRows] : [];

	// 手動で作った確定行が同じ日時にある場合は、重複した仮行を増やさない
	const hasManualFixedRowAtSameSlot = next.some((row) => {
		if (!row || typeof row !== "object") return false;
		if (isAutoManualRow(row)) return false;
		return (
			normalizeDate(row.date) === normalizeDate(entry.date) &&
			normalizeTime(row.time) === normalizeTime(entry.time)
		);
	});
	if (hasManualFixedRowAtSameSlot) {
		return { rows: next, action: "skipped_existing_slot" };
	}

	const index = next.findIndex(
		(row) =>
			normalizeUrl(row?.sourceEditUrl) === key || normalizeUrl(row?.editUrl) === key,
	);

	if (index < 0) {
		next.push({
			...entry,
			createdAt: now,
			updatedAt: now,
		});
		return { rows: next, action: "created" };
	}

	const prev = next[index];
	next[index] = {
		...prev,
		...entry,
		createdAt: prev.createdAt || now,
		updatedAt: now,
	};
	return { rows: next, action: "updated" };
}

async function main() {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has("--dry-run");
	const skipNotionScrape = args.has("--skip-notion-scrape");
	const noBuild = args.has("--no-build");

	if (!fs.existsSync(INPUT_PATH)) {
		throw new Error(`input.txt が見つかりません: ${INPUT_PATH}`);
	}

	const raw = fs.readFileSync(INPUT_PATH, "utf8");
	if (!raw.trim()) {
		throw new Error(`input.txt が空です: ${INPUT_PATH}`);
	}

	const parsed = parseInputMessage(raw);
	console.log("🧾 parsed:");
	console.log(parsed);

	let pageUrl = parsed.notionUrl || null;
	let materials = [];
	let notionDetail = null;
	let notionScrapeStatus = "skipped";

	if (parsed.notionUrl && isNotionWorkspaceUrl(parsed.notionUrl) && !skipNotionScrape) {
		try {
			const scraped = await scrapeNotionPage(parsed.notionUrl);
			pageUrl = scraped.pageUrl || parsed.notionUrl;
			materials = scraped.materials || [];
			notionDetail = scraped.detail || null;
			notionScrapeStatus = materials.length > 0 ? "ok" : "empty";
			console.log(
				`✅ notion scrape: ${materials.length} links` +
					(scraped.detail?.title ? ` / ${scraped.detail.title}` : ""),
			);
			if (materials.length === 0) {
				console.log(
					"ℹ notion scrape は実行成功しましたが、教材リンクは0件でした（ページ公開状態やページ構造をご確認ください）",
				);
			}
		} catch (e) {
			notionScrapeStatus = "failed";
			console.warn("⚠ notion scrape failed, pageUrl だけ保存します");
			console.warn(e?.message || e);
		}
	} else if (parsed.notionUrl && !isNotionWorkspaceUrl(parsed.notionUrl)) {
		console.log(
			"ℹ notion URL が NOTION_WORKSPACE_HOST と一致しないため scrape をスキップ",
		);
	}

	const overrideEntry = {
		editUrl: parsed.lmsEditUrl,
		scheduleKey: parsed.scheduleKey,
		date: parsed.date,
		time: parsed.startTime,
		endTime: parsed.endTime,
		area: parsed.course?.area || null,
		course: parsed.course?.raw || null,
		countLabel: parsed.course?.countCurrent ? `${parsed.course.countCurrent}回目` : null,
		pageUrl: pageUrl || null,
		detail: notionDetail,
		materials: uniqMaterials(materials),
		notionUrl: parsed.notionUrl || null,
		source: "orphan-override-maker",
		sourceRaw: raw.trim(),
	};

	const existing = readJsonArray(OVERRIDES_PATH);
	const { rows: updatedRows, action } = upsertOverride(existing, overrideEntry);
	const manualEntry = {
		date: parsed.date,
		time: parsed.startTime,
		studentName: AUTO_PENDING_STUDENT_NAME,
		teacherName: parsed.requesterName || null,
		area: parsed.course?.area || null,
		course: parsed.course?.raw || "(手動振替)",
		lessonUrl: AUTO_PENDING_LESSON_URL || null,
		lessonLabel: "振替授業URL",
		note: AUTO_PENDING_NOTE,
		scheduleKey: parsed.scheduleKey,
		pageUrl: pageUrl || null,
		materials: uniqMaterials(materials),
		editUrls: [parsed.lmsEditUrl],
		source: "orphan-override-maker",
		sourceEditUrl: parsed.lmsEditUrl,
		sourceRaw: raw.trim(),
	};
	const existingManual = readJsonArray(MANUAL_LESSONS_PATH);
	const { rows: updatedManualRows, action: manualAction } =
		upsertManualPendingLesson(existingManual, manualEntry);

	const result = {
		action,
		manualAction,
		dryRun,
		noBuild,
		notionScrapeStatus,
		overrideEntry,
		manualEntry,
		overridesPath: OVERRIDES_PATH,
		totalOverrides: updatedRows.length,
		manualLessonsPath: MANUAL_LESSONS_PATH,
		totalManualLessons: updatedManualRows.length,
	};

	fs.mkdirSync(WORK_DIR, { recursive: true });
	fs.writeFileSync(LAST_RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

	if (dryRun) {
		console.log("🧪 dry-run: JSONファイルは更新していません");
		console.log(`📄 result: ${LAST_RESULT_PATH}`);
		return;
	}

	fs.writeFileSync(OVERRIDES_PATH, `${JSON.stringify(updatedRows, null, 2)}\n`, "utf8");
	console.log(`💾 ${action}: ${OVERRIDES_PATH}`);
	if (manualAction === "skipped_existing_slot") {
		console.log(
			`ℹ manual pending は既存の手動行が同日時にあるため追加しません: ${parsed.date} ${parsed.startTime}`,
		);
	} else {
		fs.writeFileSync(
			MANUAL_LESSONS_PATH,
			`${JSON.stringify(updatedManualRows, null, 2)}\n`,
			"utf8",
		);
		console.log(`💾 ${manualAction}: ${MANUAL_LESSONS_PATH}`);
	}

	if (!noBuild) {
		buildOrphanVisualizerData();
		await buildSubstituteData();
		console.log("✅ build_orphan_visualizer_data / build_substitute_data done");
	} else {
		console.log("ℹ --no-build 指定のため orphan build はスキップ");
	}

	console.log(`📄 result: ${LAST_RESULT_PATH}`);
}

main().catch((err) => {
	console.error("❌ orphan-override-maker failed");
	console.error(err);
	process.exit(1);
});
