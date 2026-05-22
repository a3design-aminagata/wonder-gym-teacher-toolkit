// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/build_substitute_data.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { launchBrowser } from "../../modules/common/browser.js";
import { wait } from "../../modules/common/wait.js";
import { extractDetailPage } from "../../modules/notion/internal/actions/notionActions.js";
import { NOTION_VIEW_URL } from "../../modules/notion/scrape/schedule/constants.js";
import { normalizeTime, scheduleKeyOf } from "../../modules/common/visualizer/lib/scheduleKey.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const overridesPath = path.join(__dirname, "..", "..", "data", "manual_orphan_overrides.json");
const lmsLessonsForSchedulesPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"lms_lessons_for_schedules.json",
);
const lmsLessonsOrphanPath = path.join(
	__dirname,
	"..",
	"..",
	"data",
	"lms_lessons_orphan.json",
);
const outPath = path.join(__dirname, "data", "substitute_data.js");
const reportPath = path.join(__dirname, "data", "substitute_data_report.json");

function normalizeUrl(url) {
	const v = String(url || "").trim();
	if (!/^https?:\/\//.test(v)) return "";
	return v.replace(/\/+$/, "");
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

async function scrapeNotionPage(notionUrl, browser) {
	const page = await browser.newPage();
	try {
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
		await page.close().catch(() => {});
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

function toSubstituteRow(row) {
	const date = String(row?.date || "").trim();
	const time = normalizeTime(row?.time);
	const editUrl = normalizeUrl(row?.editUrl);
	const pageUrl = normalizeUrl(row?.pageUrl || row?.notionUrl);
	const materials = uniqMaterials(Array.isArray(row?.materials) ? row.materials : []);
	const detail =
		row?.detail && typeof row.detail === "object"
			? {
					...row.detail,
					pageUrl:
						normalizeUrl(row?.detail?.pageUrl || pageUrl || row?.notionUrl) || null,
				}
			: null;
	const scheduleKey = row?.scheduleKey || (date && time ? scheduleKeyOf(date, time) : null);

	return {
		scheduleKey,
		date,
		time,
		endTime: normalizeTime(row?.endTime),
		area: row?.area || null,
		course: row?.course || null,
		countLabel: row?.countLabel || null,
		editUrl: editUrl || null,
		pageUrl: pageUrl || null,
		notionUrl: normalizeUrl(row?.notionUrl) || null,
		detail,
		materials,
		hasMaterials: materials.length > 0,
		source: row?.source || null,
		updatedAt: row?.updatedAt || null,
	};
}

function sortByDateTime(rows = []) {
	return [...rows].sort((a, b) => {
		const ad = String(a?.date || "");
		const bd = String(b?.date || "");
		if (ad !== bd) return ad.localeCompare(bd);
		return String(a?.time || "").localeCompare(String(b?.time || ""));
	});
}

function collectResolvedIndex(rows = []) {
	const editUrls = new Set();
	const scheduleKeys = new Set();

	for (const row of rows) {
		if (!row || typeof row !== "object") continue;
		if (row.scheduleKey) scheduleKeys.add(String(row.scheduleKey));

		const scheduleEditUrl = normalizeUrl(row.scheduleEditUrl);
		if (scheduleEditUrl) editUrls.add(scheduleEditUrl);

		for (const url of Array.isArray(row.editUrls) ? row.editUrls : []) {
			const normalized = normalizeUrl(url);
			if (normalized) editUrls.add(normalized);
		}

		for (const lesson of Array.isArray(row.matchedLessons) ? row.matchedLessons : []) {
			const normalized = normalizeUrl(lesson?.editUrl);
			if (normalized) editUrls.add(normalized);
		}
	}

	return { editUrls, scheduleKeys };
}

function buildResolvedIndex() {
	const a = readJsonArray(lmsLessonsForSchedulesPath);
	const b = readJsonArray(lmsLessonsOrphanPath);
	const ia = collectResolvedIndex(a);
	const ib = collectResolvedIndex(b);

	const editUrls = new Set([...ia.editUrls, ...ib.editUrls]);
	const scheduleKeys = new Set([...ia.scheduleKeys, ...ib.scheduleKeys]);
	return { editUrls, scheduleKeys };
}

function resolveSubstituteByLms(row, resolvedIndex) {
	const editUrl = normalizeUrl(row?.editUrl);
	if (editUrl && resolvedIndex.editUrls.has(editUrl)) {
		return { resolvedByLms: true, resolvedReason: "editUrl" };
	}

	// editUrl が無い行だけ scheduleKey でフォールバック
	if (!editUrl && row?.scheduleKey && resolvedIndex.scheduleKeys.has(String(row.scheduleKey))) {
		return { resolvedByLms: true, resolvedReason: "scheduleKey" };
	}

	return { resolvedByLms: false, resolvedReason: null };
}

export async function buildSubstituteData({
	scrapeNotion = false,
	includeResolved = false,
} = {}) {
	const overrides = readJsonArray(overridesPath);
	let rows = Array.isArray(overrides) ? [...overrides] : [];
	const report = {
		scrapeNotion,
		includeResolved,
		total: rows.length,
		scraped: 0,
		failed: 0,
		empty: 0,
		skipped: 0,
	};

	if (scrapeNotion && rows.length > 0) {
		const browser = await launchBrowser();
		try {
			for (let i = 0; i < rows.length; i += 1) {
				const row = rows[i];
				const notionUrl = normalizeUrl(row?.notionUrl || row?.pageUrl);
				if (!notionUrl || !isNotionWorkspaceUrl(notionUrl)) {
					report.skipped += 1;
					continue;
				}

				try {
					const scraped = await scrapeNotionPage(notionUrl, browser);
					const materials = uniqMaterials(scraped.materials || []);
					rows[i] = {
						...row,
						pageUrl: scraped.pageUrl || notionUrl,
						notionUrl,
						detail: scraped.detail || null,
						materials,
						updatedAt: new Date().toISOString(),
					};
					report.scraped += 1;
					if (materials.length === 0) report.empty += 1;
				} catch {
					report.failed += 1;
				}
			}
		} finally {
			await browser.close().catch(() => {});
		}

			fs.writeFileSync(overridesPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
			console.log(`💾 scraped overrides updated: ${overridesPath}`);
		}

	const resolvedIndex = buildResolvedIndex();
	const normalizedRows = rows.map(toSubstituteRow).filter((r) => r.date && r.time);
	const annotatedRows = normalizedRows.map((row) => ({
		...row,
		...resolveSubstituteByLms(row, resolvedIndex),
	}));
	const resolvedCandidates = annotatedRows.filter((r) => r.resolvedByLms).length;
	const visibleRows = includeResolved
		? annotatedRows
		: annotatedRows.filter((r) => !r.resolvedByLms);

	const dataRows = sortByDateTime(visibleRows);
	const withMaterials = dataRows.filter((r) => r.hasMaterials).length;
	const js = `window.SUBSTITUTE_VISUALIZER_DATA = ${JSON.stringify(dataRows, null, 2)};\n`;
	fs.writeFileSync(outPath, js, "utf8");

	const reportRow = {
		...report,
		resolvedCandidates,
		resolvedExcluded: includeResolved ? 0 : resolvedCandidates,
		withMaterials,
		outPath,
		overridesPath,
		generatedAt: new Date().toISOString(),
	};
	fs.writeFileSync(reportPath, `${JSON.stringify(reportRow, null, 2)}\n`, "utf8");

	console.log(`✅ substitute data generated: ${outPath}`);
	console.log(`  total: ${dataRows.length}, withMaterials: ${withMaterials}`);
	console.log(
		`  resolved: candidates=${resolvedCandidates}, excluded=${reportRow.resolvedExcluded}`,
	);
	if (scrapeNotion) {
		console.log(
			`  scrape stats: scraped=${report.scraped}, empty=${report.empty}, failed=${report.failed}, skipped=${report.skipped}`,
		);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const args = new Set(process.argv.slice(2));
	const scrapeNotion = args.has("--scrape-notion");
	const includeResolved = args.has("--include-resolved");
	buildSubstituteData({ scrapeNotion, includeResolved }).catch((err) => {
		console.error("❌ build_substitute_data failed");
		console.error(err);
		process.exit(1);
	});
}
