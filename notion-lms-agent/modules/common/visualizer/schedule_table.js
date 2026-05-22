// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/schedule_table.js
import { renderScheduleTable } from "./render/renderScheduleTable.js";
import { scrollToToday } from "./ui/scroll.js";
import {
	markAsVisited,
	applyVisitedStyles,
} from "./interactions/link_tracker.js";

// 新しい職人たちをインポート
import {
	isP5TargetUrl,
	isChatGPTUrl,
} from "./data/url_matchers.js";
import {
	openWithProfile,
	runPasteCommand,
} from "./interactions/shortcut_actions.js";
import { scrollToSlot } from "./ui/scroll.js";

const ORPHAN_SHEET_URL = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit";
const MONTH_NOTION_URL = "https://www.notion.so/YOUR_MONTH_VIEW_ID";
const WONDER_GYM_NOTION_URL = "https://www.notion.so/YOUR_NOTION_PAGE_ID";
const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];
const STUDENT_FURIGANA_OVERRIDES = {};
const STUDENT_NAME_SPLIT_OVERRIDES = {};
const GEMINI_API_KEY_STORAGE_KEYS = ["WG_GEMINI_API_KEY", "GEMINI_API_KEY"];
const GEMINI_CANDIDATES = [
	{ apiVersion: "v1beta", model: "gemini-3.1-flash-lite-preview" },
	{ apiVersion: "v1beta", model: "gemini-3-flash-preview" },
	{ apiVersion: "v1beta", model: "gemini-2.5-flash-lite" },
	{ apiVersion: "v1beta", model: "gemini-2.5-flash" },
	{ apiVersion: "v1beta", model: "gemini-1.5-flash" },
	{ apiVersion: "v1", model: "gemini-2.5-flash-lite" },
	{ apiVersion: "v1", model: "gemini-2.5-flash" },
	{ apiVersion: "v1", model: "gemini-2.0-flash" },
];
const FIRST_MILESTONE_IMPORT_EVENT = "wg:firstMilestoneNotionImportRequested";
const FIRST_MILESTONE_PANEL_COLLAPSED_KEY = "viz:firstMilestonePanelCollapsed";
const LAST_MILESTONE_PANEL_COLLAPSED_KEY = "viz:lastMilestonePanelCollapsed";
const FIRST_MILESTONE_HASH_KEY = "wgfm";
const LAST_MILESTONE_JSON_ABS_PATH =
	"./data/last-milestone-comments.json";

// 外部（ui_toggles.jsなど）への公開用
window.VIZ = window.VIZ || {};
window.VIZ.scrollToToday = () => scrollToToday({ anchor: 0.2 });
window.VIZ.scrollToSlot = (opts) => scrollToSlot({ anchorX: 0.2, ...opts });
window.VIZ.openInDefaultProfile = (url) => openWithProfile(url, "Default");
window.VIZ.getLatestFirstMilestoneOutput = () => null;

// notionボタンのシングル・ダブルクリック判定用
const notionClickTimers = new WeakMap();
// ステータスリンクのシングル・ダブルクリック判定用
const statusClickTimers = new WeakMap();
let latestFirstMilestoneOutput = null;
let lastMilestoneContextMap = new Map();

function cloneJsonValue(value) {
	if (!value) return null;
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return null;
	}
}

function getSavedFirstMilestonePanelCollapsed() {
	try {
		return window.localStorage.getItem(FIRST_MILESTONE_PANEL_COLLAPSED_KEY) === "1";
	} catch {
		return false;
	}
}

function setSavedFirstMilestonePanelCollapsed(collapsed) {
	try {
		window.localStorage.setItem(
			FIRST_MILESTONE_PANEL_COLLAPSED_KEY,
			collapsed ? "1" : "0",
		);
	} catch {
		// noop
	}
}

function getSavedLastMilestonePanelCollapsed() {
	try {
		return window.localStorage.getItem(LAST_MILESTONE_PANEL_COLLAPSED_KEY) === "1";
	} catch {
		return false;
	}
}

function setSavedLastMilestonePanelCollapsed(collapsed) {
	try {
		window.localStorage.setItem(
			LAST_MILESTONE_PANEL_COLLAPSED_KEY,
			collapsed ? "1" : "0",
		);
	} catch {
		// noop
	}
}

/**
 * ヘルパー：クリックされた要素の周辺から資料URLとNotionURLを両方取得する
 */
function getTargetUrls(target) {
	const wrap = target?.closest?.(".material-link-wrap");
	if (!wrap) return null;

	const a = wrap.querySelector(".material-link");
	const btn = wrap.querySelector(".material-notion-btn");
	const p5btn = wrap.querySelector(".material-p5-btn");

	return {
		materialUrl:
			a?.href || btn?.dataset.materialUrl || p5btn?.dataset.materialUrl,
		notionUrl: btn?.dataset.notionUrl,
		p5Url: p5btn?.dataset.p5Url,
	};
}

function openManualPendingMaterial(target) {
	const badge = target?.closest?.(".badge-manual-pending");
	if (!badge) return false;

	const itemBlock = badge.closest(".item-block");
	const manualUrl = itemBlock?.dataset?.manualPendingUrl;
	if (manualUrl) {
		openWithProfile(manualUrl, "Wonder Gym（P5）");
		return true;
	}

	const materialLink = itemBlock?.querySelector(".material-link");
	if (!materialLink?.href) return false;

	openWithProfile(materialLink.href, "Wonder Gym（P5）");
	return true;
}

function shellEscape(str) {
	return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

/**
 * 複数のURLを開く（ページ離脱とUser Gesture制限の対策）
 * PasteCommand に「open ... ; open ...」を1本で送ることでジェスチャーを保持
 * Notion: Default → Chrome profile "Default"
 * 資料 / P5: Wonder Gym（P5） → Chrome profile "Profile 5"
 */
function openMultipleUrls(urls) {
	if (!urls) return;

	const profileDefault = "Default"; // Notion用
	const profileP5 = "Profile 5"; // P5用
	const commands = [];

	const defaultUrls = [];
	if (urls.notionUrl) defaultUrls.push(urls.notionUrl);
	if (Array.isArray(urls.extraDefaultUrls)) {
		defaultUrls.push(...urls.extraDefaultUrls);
	}
	const uniqueDefaultUrls = [...new Set(defaultUrls.filter(Boolean))];

	for (const defaultUrl of uniqueDefaultUrls) {
		commands.push(
			`open -na "Google Chrome" --args --profile-directory=${shellEscape(profileDefault)} ${shellEscape(defaultUrl)}`,
		);
	}
	if (urls.p5Url) {
		commands.push(
			`open -na "Google Chrome" --args --profile-directory=${shellEscape(profileP5)} ${shellEscape(urls.p5Url)}`,
		);
	}
	if (urls.materialUrl) {
		commands.push(
			`open -na "Google Chrome" --args --profile-directory=${shellEscape(profileP5)} ${shellEscape(urls.materialUrl)}`,
		);
	}

	if (!commands.length) return;

	const fullCommand = `[SILENT]${commands.join(" ; ")}`;
	runPasteCommand(fullCommand, "PasteCommand");
}

/**
 * ステータスリンクの通常クリック:
 * LMS(P5) + Wonder Gym Notion(Default) を開く
 */
function openStatusLinkOnce(href, anchorEl) {
	if (!href) return;

	if (isP5TargetUrl(href)) {
		markAsVisited(href);
		anchorEl?.classList.add("is-visited");
		openMultipleUrls({
			notionUrl: WONDER_GYM_NOTION_URL,
			p5Url: href,
		});
		return;
	}

	if (isChatGPTUrl(href)) {
		openWithProfile(href, "Default");
		return;
	}

	// fallback: ブラウザのデフォルト動作
	window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * ステータスリンクをダブルクリックで
 * Notion（月次） + Wonder Gym Notion + ステータスURL の3本を開く
 */
function openStatusLinkWithNotion(href) {
	if (!href) return;

	const urls = {
		notionUrl: MONTH_NOTION_URL,
		extraDefaultUrls: [WONDER_GYM_NOTION_URL],
	};

	if (isP5TargetUrl(href)) {
		urls.p5Url = href;
	} else {
		urls.materialUrl = href;
	}

	openMultipleUrls(urls);
}

function toHiragana(text) {
	return String(text || "").replace(/[\u30a1-\u30f6]/g, (ch) =>
		String.fromCharCode(ch.charCodeAt(0) - 0x60),
	);
}

function toKatakana(text) {
	return String(text || "").replace(/[\u3041-\u3096]/g, (ch) =>
		String.fromCharCode(ch.charCodeAt(0) + 0x60),
	);
}

function charType(ch) {
	if (/[\u4e00-\u9fff々〆ヵヶ]/u.test(ch)) return "kanji";
	if (/[\u3041-\u3096]/u.test(ch)) return "hiragana";
	if (/[\u30a1-\u30faー]/u.test(ch)) return "katakana";
	return "other";
}

function findScriptBoundary(name) {
	for (let i = 1; i < name.length; i += 1) {
		const left = charType(name[i - 1]);
		const right = charType(name[i]);
		if (left !== right && left !== "other" && right !== "other") {
			return i;
		}
	}
	return -1;
}

function splitName(fullName) {
	const name = String(fullName || "").trim();
	if (!name) {
		return { fullName: "", surname: "", givenName: "", surnameLength: 0 };
	}
	const forced = STUDENT_NAME_SPLIT_OVERRIDES[name];
	if (forced?.surname) {
		const givenName = String(forced.givenName || name.slice(forced.surname.length));
		return {
			fullName: name,
			surname: forced.surname,
			givenName,
			surnameLength: forced.surname.length,
		};
	}

	const withSpace = name.split(/[\u3000\s]+/).filter(Boolean);
	if (withSpace.length >= 2) {
		const surname = withSpace[0];
		const givenName = withSpace.slice(1).join("");
		return {
			fullName: name,
			surname,
			givenName,
			surnameLength: surname.length,
		};
	}

	const boundary = findScriptBoundary(name);
	if (boundary > 0 && boundary < name.length) {
		return {
			fullName: name,
			surname: name.slice(0, boundary),
			givenName: name.slice(boundary),
			surnameLength: boundary,
		};
	}

	let surnameLength = 2;
	if (name.length <= 2) surnameLength = 1;
	else if (name.length === 3) surnameLength = 2;
	else if (name.length >= 6) surnameLength = 3;

	if (surnameLength >= name.length) surnameLength = Math.max(1, name.length - 1);

	return {
		fullName: name,
		surname: name.slice(0, surnameLength),
		givenName: name.slice(surnameLength),
		surnameLength,
	};
}

function splitReading(fullReading, split) {
	const reading = String(fullReading || "").trim();
	const surnameLength = Number(split?.surnameLength || 0);
	const fullNameLength = Number(split?.fullName?.length || 0);
	const givenName = String(split?.givenName || "");
	if (!reading) {
		return { fullReading: "", surnameReading: "", givenReading: "" };
	}
	if (surnameLength <= 0 || surnameLength >= fullNameLength) {
		return {
			fullReading: reading,
			surnameReading: reading,
			givenReading: "",
		};
	}

	const givenKanaAnchor = toKatakana(
		[...givenName].filter((ch) => /[\u3041-\u3096\u30a1-\u30faー]/u.test(ch)).join(""),
	);
	if (givenKanaAnchor) {
		const idx = reading.lastIndexOf(givenKanaAnchor);
		if (idx > 0 && idx < reading.length) {
			return {
				fullReading: reading,
				surnameReading: reading.slice(0, idx),
				givenReading: reading.slice(idx),
			};
		}
	}

	let cut = Math.floor((reading.length * surnameLength) / fullNameLength);
	if (surnameLength === 1 && cut === 1 && reading.length >= 4) {
		cut = 2;
	}
	cut = Math.max(1, Math.min(reading.length - 1, cut));

	return {
		fullReading: reading,
		surnameReading: reading.slice(0, cut),
		givenReading: reading.slice(cut),
	};
}

function normalizeNameKey(name) {
	return String(name || "").replace(/[\u3000\s]/g, "").trim();
}

function hasKana(text) {
	return /[\u3041-\u3096\u30a1-\u30faー]/u.test(String(text || ""));
}

function recordsNeedAi(records) {
	return (records || []).some(
		(r) => !hasKana(r.fullReading) || !hasKana(r.givenReading) || !hasKana(r.surnameReading),
	);
}

function getGeminiApiKey() {
	try {
		for (const keyName of GEMINI_API_KEY_STORAGE_KEYS) {
			const existing = String(window.localStorage.getItem(keyName) || "").trim();
			if (existing) return existing;
		}
	} catch {
		// noop
	}

	const input = window.prompt(
		"Gemini APIキーを入力してください（1回のみ保存）",
		"",
	);
	const key = String(input || "").trim();
	if (!key) return "";
	try {
		for (const keyName of GEMINI_API_KEY_STORAGE_KEYS) {
			window.localStorage.setItem(keyName, key);
		}
	} catch {
		// noop
	}
	return key;
}

function extractGeminiText(json) {
	const parts = [];
	for (const cand of json?.candidates || []) {
		for (const part of cand?.content?.parts || []) {
			if (typeof part?.text === "string" && part.text.trim()) {
				parts.push(part.text);
			}
		}
	}
	return parts.join("\n").trim();
}

function parseJsonArrayText(text) {
	const source = String(text || "").trim();
	if (!source) return null;

	try {
		const parsed = JSON.parse(source);
		if (Array.isArray(parsed)) return parsed;
	} catch {
		// noop
	}

	const fence = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence?.[1]) {
		try {
			const parsed = JSON.parse(fence[1].trim());
			if (Array.isArray(parsed)) return parsed;
		} catch {
			// noop
		}
	}

	const start = source.indexOf("[");
	const end = source.lastIndexOf("]");
	if (start >= 0 && end > start) {
		try {
			const parsed = JSON.parse(source.slice(start, end + 1));
			if (Array.isArray(parsed)) return parsed;
		} catch {
			// noop
		}
	}
	return null;
}

function buildGeminiPrompt(records) {
	const rows = records.map((r) => ({
		fullName: r.fullName,
		furiganaHint: r.fullReading || "",
	}));
	return [
		"あなたは日本語氏名の読み分割器です。",
		"入力配列の順序を必ず維持し、JSON配列のみを返してください（説明文・コードブロック禁止）。",
		'[{"fullName":"", "surname":"", "surnameReadingHiragana":"", "givenReadingKatakana":""}]',
		"",
		"ルール:",
		"- surname は漢字の姓",
		"- surnameReadingHiragana は ひらがな",
		"- givenReadingKatakana は カタカナ",
		"- furiganaHint がある場合は必ず整合させる",
		"- 不明でも空文字にせず自然な推定で埋める",
		"- 同音異字の可能性があっても最も自然な読みを採用する",
		"",
		"入力:",
		JSON.stringify(rows),
	].join("\n");
}

function normalizeGeminiRows(rows) {
	return (rows || [])
		.map((row) => ({
			fullName: String(row?.fullName || "").trim(),
			surname: String(row?.surname || "").trim(),
			surnameReading: toHiragana(
				String(
					row?.surnameReadingHiragana || row?.surnameReading || row?.familyReading || "",
				).trim(),
			),
			givenReading: toKatakana(
				String(
					row?.givenReadingKatakana || row?.givenReading || row?.firstReading || "",
				).trim(),
			),
		}))
		.filter(
			(row) =>
				row.fullName && row.surname && hasKana(row.surnameReading) && hasKana(row.givenReading),
		);
}

async function fetchGeminiNameRows(apiKey, records) {
	const prompt = buildGeminiPrompt(records);
	let lastError = "";
	for (const candidate of GEMINI_CANDIDATES) {
		const body = {
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: { temperature: 0.1 },
		};
		if (candidate.apiVersion === "v1beta") {
			body.generationConfig.responseMimeType = "application/json";
		}
		const tag = `${candidate.apiVersion}/${candidate.model}`;
		try {
			const res = await fetch(
				`https://generativelanguage.googleapis.com/${candidate.apiVersion}/models/${candidate.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				lastError = `${tag}: ${json?.error?.message || res.status}`;
				continue;
			}
			const text = extractGeminiText(json);
			const parsed = parseJsonArrayText(text);
			if (parsed && parsed.length) {
				const rows = normalizeGeminiRows(parsed);
				if (rows.length) return { rows, model: tag };
				lastError = `${tag}: parsed but missing required fields`;
				continue;
			}
			lastError = `${tag}: empty or invalid JSON`;
		} catch (err) {
			lastError = `${tag}: ${err?.message || String(err)}`;
		}
	}

	return { rows: [], model: "", error: lastError || "Gemini request failed" };
}

async function enrichRecordsWithGemini(records) {
	if (!recordsNeedAi(records)) {
		return { ok: true, records, note: "（読みは既存データを使用）" };
	}

	const apiKey = getGeminiApiKey();
	if (!apiKey) {
		return {
			ok: false,
			records,
			note: "（Geminiキー未設定）",
			error: "Gemini APIキーが未設定です。",
		};
	}

	const result = await fetchGeminiNameRows(apiKey, records);
	if (!result.rows.length) {
		return {
			ok: false,
			records,
			note: "（Gemini取得失敗）",
			error: result.error || "unknown",
		};
	}

	const aiMap = new Map(
		result.rows.map((row) => [normalizeNameKey(row.fullName), row]),
	);
	const next = records.map((record) => {
		const ai = aiMap.get(normalizeNameKey(record.fullName));
		if (!ai) return record;

		return {
			...record,
			surname: ai.surname || record.surname,
			surnameReading: ai.surnameReading || record.surnameReading,
			givenReading: ai.givenReading || record.givenReading,
			fullReading:
				toKatakana(ai.surnameReading || "") + toKatakana(ai.givenReading || ""),
		};
	});

	return { ok: true, records: next, note: `（Gemini: ${result.model}）` };
}

function toDateLabel(dateText) {
	const dt = new Date(`${dateText}T00:00:00`);
	if (Number.isNaN(dt.getTime())) return dateText;
	const week = WEEKDAYS_JP[dt.getDay()] || "";
	const mm = String(dt.getMonth() + 1);
	const dd = String(dt.getDate());
	return `${mm}/${dd}（${week}）`;
}

function toWeekdayToggleLabel(dateText) {
	const dt = new Date(`${dateText}T00:00:00`);
	if (Number.isNaN(dt.getTime())) return "";
	const week = WEEKDAYS_JP[dt.getDay()] || "";
	return week ? `${week}曜` : "";
}

function normalizeClock(clockText) {
	const m = String(clockText || "")
		.trim()
		.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return "";
	const hour = Number(m[1]);
	const minute = Number(m[2]);
	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addHoursToClock(clockText, hoursToAdd) {
	const normalized = normalizeClock(clockText);
	if (!normalized) return "";
	const [hh, mm] = normalized.split(":").map((v) => Number(v));
	const nextHour = ((hh + Number(hoursToAdd || 0)) % 24 + 24) % 24;
	return `${String(nextHour).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function buildNotionTitle(area, timeText) {
	const areaText = String(area || "").trim() || "未設定";
	const raw = String(timeText || "").trim();
	const rangeMatch = raw.match(
		/(\d{1,2}:\d{2})\s*[~〜\-–ー]\s*(\d{1,2}:\d{2})/,
	);
	if (rangeMatch) {
		const start = normalizeClock(rangeMatch[1]);
		const end = normalizeClock(rangeMatch[2]);
		if (start && end) return `${areaText} ${start} ~ ${end}`;
	}

	const start = normalizeClock(raw);
	if (start) {
		const end = addHoursToClock(start, 1);
		if (end) return `${areaText} ${start} ~ ${end}`;
		return `${areaText} ${start}`;
	}
	if (raw) return `${areaText} ${raw}`;
	return areaText;
}

function parseJsonArray(rawValue) {
	if (!rawValue) return [];
	try {
		const parsed = JSON.parse(rawValue);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function lastMilestoneContextKey(date, time, course) {
	const d = String(date || "").trim();
	const t = normalizeClock(time || "") || String(time || "").trim();
	const c = String(course || "").trim();
	return `${d}|${t}|${c}`;
}

function buildLastMilestoneContextMap(visualizerData) {
	const map = new Map();
	const buckets = [
		...(visualizerData?.mine || []),
		...(visualizerData?.available || []),
		...(visualizerData?.past || []),
	];
	for (const item of buckets) {
		const key = lastMilestoneContextKey(item?.date, item?.time, item?.course);
		if (!key || map.has(key)) continue;
		map.set(key, {
			slotStudentHistories: Array.isArray(item?.slotStudentHistories)
				? item.slotStudentHistories
				: [],
		});
	}
	return map;
}

function buildLastMeetingRecords(lastStudents, slotStudentHistories) {
	const historyMap = new Map(
		(slotStudentHistories || [])
			.map((entry) => ({
				name: String(entry?.name || "").trim(),
				furigana: String(entry?.furigana || "").trim(),
				comments: Array.isArray(entry?.comments) ? entry.comments : [],
			}))
			.filter((entry) => entry.name)
			.map((entry) => [entry.name, entry]),
	);

	return (lastStudents || [])
		.map((name) => String(name || "").trim())
		.filter(Boolean)
		.map((name) => {
				const hist = historyMap.get(name) || {
					furigana: STUDENT_FURIGANA_OVERRIDES[name] || "",
					comments: [],
				};
				const furigana = hist.furigana || STUDENT_FURIGANA_OVERRIDES[name] || "";
				const split = splitName(name);
				const reading = splitReading(furigana, split);
				const comments = (hist.comments || [])
					.map((row) => String(row?.comment || "").trim())
					.filter(Boolean);
			return {
				fullName: split.fullName,
				surname: split.surname || split.fullName,
				givenName: split.givenName,
				fullReading: reading.fullReading,
				surnameReading: reading.surnameReading,
				givenReading: reading.givenReading,
				comments,
				strengths: [],
				graduationComment: "",
			};
		});
}

function buildGraduationPrompt(records) {
	const input = records.map((r) => ({
		fullName: r.fullName,
		comments: (r.comments || []).slice(-8),
	}));
	return [
		"あなたは講師コメントの編集者です。",
		"入力は生徒ごとの過去コメントです。生徒ごとに、卒業前に伝えるべき強みを要約してください。",
		"JSON配列のみを返してください。説明文やコードブロックは禁止。",
		'[{"fullName":"","strengths":["",""],"graduationComment":""}]',
		"",
		"ルール:",
		"- strengths は2〜3件、各項目は25文字以内",
		"- graduationComment は90〜150文字、敬体（です/ます）",
		"- 過度に抽象化せず、コメント内容に基づく強みを抜き出す",
		"- 入力配列の順序を維持する",
		"- 不明でも空文字にせず、最も自然な要約を作る",
		"",
		"入力:",
		JSON.stringify(input),
	].join("\n");
}

function normalizeGraduationRows(rows) {
	return (rows || [])
		.map((row) => ({
			fullName: String(row?.fullName || "").trim(),
			strengths: Array.isArray(row?.strengths)
				? row.strengths
						.map((s) => String(s || "").trim())
						.filter(Boolean)
						.slice(0, 3)
				: [],
			graduationComment: String(row?.graduationComment || "").trim(),
		}))
		.filter((row) => row.fullName);
}

async function fetchGeminiGraduationRows(apiKey, records) {
	const prompt = buildGraduationPrompt(records);
	let lastError = "";
	for (const candidate of GEMINI_CANDIDATES) {
		const body = {
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: { temperature: 0.3 },
		};
		if (candidate.apiVersion === "v1beta") {
			body.generationConfig.responseMimeType = "application/json";
		}
		const tag = `${candidate.apiVersion}/${candidate.model}`;
		try {
			const res = await fetch(
				`https://generativelanguage.googleapis.com/${candidate.apiVersion}/models/${candidate.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				lastError = `${tag}: ${json?.error?.message || res.status}`;
				continue;
			}
			const text = extractGeminiText(json);
			const parsed = parseJsonArrayText(text);
			if (parsed && parsed.length) {
				const rows = normalizeGraduationRows(parsed);
				if (rows.length) return { rows, model: tag };
				lastError = `${tag}: parsed but missing required fields`;
				continue;
			}
			lastError = `${tag}: empty or invalid JSON`;
		} catch (err) {
			lastError = `${tag}: ${err?.message || String(err)}`;
		}
	}
	return { rows: [], model: "", error: lastError || "Gemini request failed" };
}

function buildGraduationFallbackRecords(records) {
	return records.map((record) => {
		const base =
			record.comments?.[record.comments.length - 1] ||
			record.comments?.[0] ||
			"これまでの学習姿勢と取り組みを一貫して継続できています。";
		return {
			...record,
			strengths: ["継続的な学習姿勢", "考えを言語化する力"],
			graduationComment: base,
		};
	});
}

async function enrichLastMeetingRecordsWithGemini(records) {
	const apiKey = getGeminiApiKey();
	if (!apiKey) {
		return {
			ok: false,
			records: buildGraduationFallbackRecords(records),
			note: "（Geminiキー未設定）",
			error: "Gemini APIキーが未設定です。",
		};
	}
	const result = await fetchGeminiGraduationRows(apiKey, records);
	if (!result.rows.length) {
		return {
			ok: false,
			records: buildGraduationFallbackRecords(records),
			note: "（Gemini取得失敗）",
			error: result.error || "unknown",
		};
	}

	const aiMap = new Map(
		result.rows.map((row) => [normalizeNameKey(row.fullName), row]),
	);
	const next = records.map((record) => {
		const ai = aiMap.get(normalizeNameKey(record.fullName));
		if (!ai) return record;
		return {
			...record,
			strengths:
				Array.isArray(ai.strengths) && ai.strengths.length
					? ai.strengths
					: record.strengths,
			graduationComment: ai.graduationComment || record.graduationComment,
		};
	});
	return {
		ok: true,
		records: next,
		note: `（Gemini: ${result.model}）`,
	};
}

function buildFirstMeetingRecords(firstStudents, slotStudents) {
	const slotMap = new Map(
		(slotStudents || [])
			.map((s) => ({
				name: String(s?.name || "").trim(),
				furigana: String(s?.furigana || "").trim(),
			}))
			.filter((s) => s.name)
			.map((s) => [s.name, s.furigana]),
	);

	return (firstStudents || [])
		.map((name) => String(name || "").trim())
		.filter(Boolean)
		.map((name) => {
			const furigana =
				slotMap.get(name) || STUDENT_FURIGANA_OVERRIDES[name] || "";
			const split = splitName(name);
			const reading = splitReading(furigana, split);
			return {
				fullName: split.fullName,
				surname: split.surname || split.fullName,
				givenName: split.givenName,
				fullReading: reading.fullReading,
				surnameReading: reading.surnameReading,
				givenReading: reading.givenReading,
			};
		});
}

function formatDisplayName(record, useFullName) {
	const fullReadingHira = toHiragana(record.fullReading);
	if (useFullName || !record.givenName) {
		if (!fullReadingHira) return record.fullName;
		return `${record.fullName}（${fullReadingHira}）`;
	}
	const surnameReading = toHiragana(record.surnameReading || record.fullReading);
	const givenReadingKata = String(record.givenReading || "").trim();
	if (surnameReading && givenReadingKata) {
		return `${record.surname}（${surnameReading}）${givenReadingKata}`;
	}
	if (surnameReading) {
		return `${record.surname}（${surnameReading}）${record.givenName || ""}`;
	}
	if (givenReadingKata) {
		return `${record.surname}${givenReadingKata}`;
	}
	return record.fullName;
}

function buildOutputBlocks(records) {
	const surnameCount = new Map();
	for (const r of records) {
		surnameCount.set(r.surname, (surnameCount.get(r.surname) || 0) + 1);
	}

	const displayNames = records.map((r) =>
		formatDisplayName(r, (surnameCount.get(r.surname) || 0) >= 2),
	);

	const speechBlock = displayNames
		.map(
			(name) =>
				`${name} さん\n\n「\n\n」\nと発表してくれた\n\nーーーーーーーーーーー`,
		)
		.join("\n\n");

	const checklistBlock = displayNames
		.map((name) => `- [ ]  ${name} さん`)
		.join("\n");

	return { speechBlock, checklistBlock };
}

function buildGraduationOutputBlocks(records) {
	const commentBlock = records
		.map((record) => {
			const displayName = formatDisplayName(record, false);
			const comment =
				String(record.graduationComment || "").trim() ||
				"これまでの学びを活かして、次の挑戦でも力を発揮できると思います。";
			return `${displayName} さん\n\n${comment}\n\nーーーーーーーーーーー`;
		})
		.join("\n\n");

	const strengthBlock = records
		.map((record) => {
			const displayName = formatDisplayName(record, false);
			const strengths = (record.strengths || []).filter(Boolean).slice(0, 3);
			if (!strengths.length) return `- ${displayName} さん: 学習姿勢が安定している`;
			return `- ${displayName} さん: ${strengths.join(" / ")}`;
		})
		.join("\n");

	return { commentBlock, strengthBlock };
}

function ensureMilestoneOutputPanel() {
	let panel = document.getElementById("viz-milestone-output");
	if (panel) return panel;

	const controls = document.getElementById("viz-controls");
	if (!controls || !controls.parentElement) return null;

	panel = document.createElement("section");
	panel.id = "viz-milestone-output";
	panel.className = "viz-output-panel";
	panel.hidden = true;
	panel.innerHTML = `
		<div class="viz-output-head">
			<div class="viz-output-head-row">
				<strong class="viz-output-title">
					<span class="viz-output-title-emoji">🔰</span>
					<span class="viz-output-title-text"> 初回テンプレート出力</span>
				</strong>
				<button type="button" id="viz-output-collapse-btn" class="viz-output-collapse-btn" aria-pressed="false">小さくする</button>
			</div>
			<div id="viz-output-meta" class="viz-output-meta"></div>
			<div class="viz-output-actions">
				<button type="button" id="viz-output-notion-import-btn" class="viz-output-import-btn" disabled>Notionへ投入</button>
				<span id="viz-output-notion-import-toast" class="viz-output-import-toast" aria-hidden="true"></span>
			</div>
		</div>
		<div class="viz-output-body">
		<div class="viz-output-block-wrap">
			<div class="viz-output-label-row">
				<div class="viz-output-label">Notionタイトル</div>
				<button type="button" class="viz-output-copy-btn" data-copy-target="viz-output-notion-title">コピー</button>
				<span class="viz-output-copy-toast" aria-hidden="true">コピーしました</span>
			</div>
			<textarea id="viz-output-notion-title" class="viz-output-textarea" readonly></textarea>
		</div>
		<div class="viz-output-block-wrap">
			<div class="viz-output-label-row">
				<div class="viz-output-label">発表用テンプレート</div>
				<button type="button" class="viz-output-copy-btn" data-copy-target="viz-output-speech">コピー</button>
				<span class="viz-output-copy-toast" aria-hidden="true">コピーしました</span>
			</div>
			<textarea id="viz-output-speech" class="viz-output-textarea" readonly></textarea>
		</div>
		<div class="viz-output-block-wrap">
			<div class="viz-output-label-row">
				<div class="viz-output-label">チェック用リスト</div>
				<button type="button" class="viz-output-copy-btn" data-copy-target="viz-output-checklist">コピー</button>
				<span class="viz-output-copy-toast" aria-hidden="true">コピーしました</span>
			</div>
			<textarea id="viz-output-checklist" class="viz-output-textarea" readonly></textarea>
		</div>
		</div>
	`;
	controls.parentElement.insertBefore(panel, controls);
	setMilestoneOutputPanelCollapsed(panel, getSavedFirstMilestonePanelCollapsed(), {
		saveState: false,
	});
	return panel;
}

function setMilestoneOutputPanelCollapsed(
	panel,
	collapsed,
	{ saveState = true } = {},
) {
	if (!(panel instanceof HTMLElement)) return;
	const nextCollapsed = Boolean(collapsed);
	panel.classList.toggle("is-collapsed", nextCollapsed);
	const btn = panel.querySelector("#viz-output-collapse-btn");
	if (btn instanceof HTMLButtonElement) {
		btn.textContent = nextCollapsed ? "開く" : "小さくする";
		btn.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
	}
	if (saveState) {
		setSavedFirstMilestonePanelCollapsed(nextCollapsed);
	}
}

function ensureLastMilestoneOutputPanel() {
	let panel = document.getElementById("viz-last-output");
	if (panel) return panel;

	const controls = document.getElementById("viz-controls");
	if (!controls || !controls.parentElement) return null;

	panel = document.createElement("section");
	panel.id = "viz-last-output";
	panel.className = "viz-output-panel viz-last-output-panel";
	panel.hidden = true;
	panel.innerHTML = `
		<div class="viz-output-head">
			<div class="viz-output-head-row">
				<strong class="viz-output-title">
					<span class="viz-output-title-emoji">🎓</span>
					<span class="viz-output-title-text"> 最終回コメント出力</span>
				</strong>
				<button type="button" id="viz-last-output-collapse-btn" class="viz-output-collapse-btn" aria-pressed="false">小さくする</button>
			</div>
			<div id="viz-last-output-meta" class="viz-output-meta"></div>
		</div>
		<div class="viz-output-body">
		<div class="viz-output-block-wrap">
			<div class="viz-output-label-row">
				<div class="viz-output-label">卒業コメント案</div>
				<button type="button" class="viz-output-copy-btn" data-copy-target="viz-last-output-comment">コピー</button>
				<span class="viz-output-copy-toast" aria-hidden="true">コピーしました</span>
			</div>
			<textarea id="viz-last-output-comment" class="viz-output-textarea" readonly></textarea>
		</div>
			<div class="viz-output-block-wrap">
				<div class="viz-output-label-row">
					<div class="viz-output-label">強みメモ</div>
					<button type="button" class="viz-output-copy-btn" data-copy-target="viz-last-output-strengths">コピー</button>
					<span class="viz-output-copy-toast" aria-hidden="true">コピーしました</span>
				</div>
				<textarea id="viz-last-output-strengths" class="viz-output-textarea" readonly></textarea>
			</div>
			<div class="viz-output-block-wrap">
				<div class="viz-output-label-row">
					<div class="viz-output-label">外部AI用</div>
					<button type="button" id="viz-last-copy-prompt-btn" class="viz-output-copy-btn" data-copy-value="">プロンプト</button>
					<button type="button" id="viz-last-copy-json-path-btn" class="viz-output-copy-btn" data-copy-value="">JSONパス</button>
					<span class="viz-output-copy-toast" aria-hidden="true">コピーしました</span>
				</div>
			</div>
			</div>
		`;
	controls.parentElement.insertBefore(panel, controls);
	setLastMilestoneOutputPanelCollapsed(panel, getSavedLastMilestonePanelCollapsed(), {
		saveState: false,
	});
	return panel;
}

function setLastMilestoneOutputPanelCollapsed(
	panel,
	collapsed,
	{ saveState = true } = {},
) {
	if (!(panel instanceof HTMLElement)) return;
	const nextCollapsed = Boolean(collapsed);
	panel.classList.toggle("is-collapsed", nextCollapsed);
	const btn = panel.querySelector("#viz-last-output-collapse-btn");
	if (btn instanceof HTMLButtonElement) {
		btn.textContent = nextCollapsed ? "開く" : "小さくする";
		btn.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
	}
	if (saveState) {
		setSavedLastMilestonePanelCollapsed(nextCollapsed);
	}
}

function setOutputTextareaValue(textarea, value) {
	if (!(textarea instanceof HTMLTextAreaElement)) return;
	textarea.value = String(value || "");
	textarea.style.height = "auto";
	const nextHeight = Math.min(420, Math.max(72, textarea.scrollHeight + 2));
	textarea.style.height = `${nextHeight}px`;
}

async function copyTextToClipboard(text) {
	const raw = String(text || "");
	if (!raw) return false;
	try {
		await navigator.clipboard.writeText(raw);
		return true;
	} catch {
		return false;
	}
}

function showOutputCopyToast(buttonEl) {
	if (!(buttonEl instanceof HTMLElement)) return;
	const wrap = buttonEl.closest(".viz-output-label-row");
	const toast = wrap?.querySelector(".viz-output-copy-toast");
	if (!(toast instanceof HTMLElement)) return;
	toast.classList.add("show");
	window.setTimeout(() => {
		toast.classList.remove("show");
	}, 1200);
}

function showNotionImportToast(message, isError = false) {
	const toast = document.getElementById("viz-output-notion-import-toast");
	if (!(toast instanceof HTMLElement)) return;
	toast.textContent = String(message || "");
	toast.classList.toggle("is-error", Boolean(isError));
	toast.classList.add("show");
	window.setTimeout(() => {
		toast.classList.remove("show");
	}, 1800);
}

function encodeBase64UrlUtf8(text) {
	const source = String(text || "");
	try {
		const bytes = new TextEncoder().encode(source);
		let binary = "";
		for (const b of bytes) binary += String.fromCharCode(b);
		return btoa(binary)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/g, "");
	} catch {
		return "";
	}
}

function buildFirstMilestoneNotionUrl(payload) {
	const compact = {
		requestId:
			String(payload?.requestId || "").trim() ||
			`${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
		notionTitle: String(payload?.notionTitle || payload?.lessonTitle || "").trim(),
		date: String(payload?.date || "").trim(),
		time: String(payload?.time || "").trim(),
	};
	const encoded = encodeBase64UrlUtf8(JSON.stringify(compact));
	if (!encoded) return WONDER_GYM_NOTION_URL;

	try {
		const u = new URL(WONDER_GYM_NOTION_URL);
		u.hash = `${FIRST_MILESTONE_HASH_KEY}=${encoded}`;
		return u.toString();
	} catch {
		const sep = WONDER_GYM_NOTION_URL.includes("#") ? "&" : "#";
		return `${WONDER_GYM_NOTION_URL}${sep}${FIRST_MILESTONE_HASH_KEY}=${encoded}`;
	}
}

function buildLastMilestoneCommentsSnapshot({ badgeEl, records }) {
	const students = (records || []).map((record) => ({
		fullName: String(record?.fullName || "").trim(),
		furigana: String(record?.fullReading || "").trim(),
		comments: Array.isArray(record?.comments)
			? record.comments.map((c) => String(c || "").trim()).filter(Boolean)
			: [],
	}));
	return {
		version: 1,
		generatedAt: new Date().toISOString(),
		date: String(badgeEl?.dataset?.date || "").trim(),
		time: String(badgeEl?.dataset?.time || "").trim(),
		area: String(badgeEl?.dataset?.area || "").trim(),
		course: String(badgeEl?.dataset?.course || "").trim(),
		statusUrl: String(badgeEl?.dataset?.statusUrl || "").trim(),
		students,
	};
}

function writeLastMilestoneCommentsJson(snapshot) {
	if (!snapshot) return false;
	const jsonText = JSON.stringify(snapshot, null, 2);
	const encoded = encodeBase64UrlUtf8(jsonText);
	if (!encoded) return false;

	const pythonScript = [
		"import base64, pathlib",
		`p = pathlib.Path(${JSON.stringify(LAST_MILESTONE_JSON_ABS_PATH)})`,
		`s = ${JSON.stringify(encoded)}`,
		"s += '=' * (-len(s) % 4)",
		"p.parent.mkdir(parents=True, exist_ok=True)",
		"p.write_bytes(base64.urlsafe_b64decode(s.encode()))",
	].join("\n");
	const command = `[SILENT]python3 - <<'PY'\n${pythonScript}\nPY`;
	runPasteCommand(command, "PasteCommand");
	return true;
}

function emitFirstMilestoneImportEvent(payload) {
	const detail = cloneJsonValue(payload);
	if (!detail) return false;
	const event = new CustomEvent(FIRST_MILESTONE_IMPORT_EVENT, { detail });
	window.dispatchEvent(event);
	document.dispatchEvent(event);
	return true;
}

function requestFirstMilestoneNotionImport() {
	const payload = window.VIZ?.getLatestFirstMilestoneOutput?.();
	if (!payload) {
		showNotionImportToast("先に🔰をクリックしてください。", true);
		return false;
	}
	const ok = emitFirstMilestoneImportEvent(payload);
	if (!ok) {
		showNotionImportToast("投入データの準備に失敗しました。", true);
		return false;
	}
	const notionUrl = buildFirstMilestoneNotionUrl(payload);
	openWithProfile(notionUrl, "Default");
	showNotionImportToast("Notionへの投入を開始しました。");
	return true;
}

async function copyOutputTextareaById(targetId) {
	const textarea = document.getElementById(targetId);
	if (!(textarea instanceof HTMLTextAreaElement)) return false;
	const text = textarea.value || "";
	if (!text) return false;

	const copied = await copyTextToClipboard(text);
	if (copied) return true;

	try {
		textarea.focus();
		textarea.select();
		return Boolean(document.execCommand("copy"));
	} catch {
		return false;
	}
}

async function copyBothBlocksToClipboard(speechBlock, checklistBlock) {
	const combined = [
		"```",
		speechBlock,
		"```",
		"",
		"```",
		checklistBlock,
		"```",
	].join("\n");

	try {
		await navigator.clipboard.writeText(combined);
		return true;
	} catch {
		return false;
	}
}

async function handleFirstMilestoneClick(badgeEl) {
	const firstStudents = parseJsonArray(badgeEl.dataset.firstStudents);
	const slotStudents = parseJsonArray(badgeEl.dataset.slotStudents);
	if (!firstStudents.length) return false;

	const records = buildFirstMeetingRecords(firstStudents, slotStudents);
	if (!records.length) return false;

	const needsAi = recordsNeedAi(records);
	const enriched = await enrichRecordsWithGemini(records);
	const panel = ensureMilestoneOutputPanel();
	if (!panel) return false;
	const lastPanel = document.getElementById("viz-last-output");
	if (lastPanel) lastPanel.hidden = true;

	const notionTitleArea = panel.querySelector("#viz-output-notion-title");
	const speechCode = panel.querySelector("#viz-output-speech");
	const checklistCode = panel.querySelector("#viz-output-checklist");
	const meta = panel.querySelector("#viz-output-meta");
	const notionImportBtn = panel.querySelector("#viz-output-notion-import-btn");

	if (
		!notionTitleArea ||
		!speechCode ||
		!checklistCode ||
		!meta ||
		!notionImportBtn
	) {
		return false;
	}

	const dateLabel = toDateLabel(badgeEl.dataset.date || "");
	const time = badgeEl.dataset.time || "";
	const area = badgeEl.dataset.area || "";
	const notionTitle = buildNotionTitle(area, time);
	const lessonLink = badgeEl.dataset.statusUrl || "";
	const linkText = lessonLink
		? ` / LMS: <a href="${lessonLink}" target="_blank" rel="noopener noreferrer">▶</a>`
		: "";

	if (needsAi && !enriched.ok) {
		latestFirstMilestoneOutput = null;
		window.VIZ.getLatestFirstMilestoneOutput = () => null;
		notionImportBtn.disabled = true;
		setOutputTextareaValue(notionTitleArea, notionTitle);
		setOutputTextareaValue(
			speechCode,
			"AIで読み仮名の補完に失敗しました。Gemini APIキーを確認して、もう一度🔰をクリックしてください。",
		);
		setOutputTextareaValue(checklistCode, `Error: ${enriched.error || "unknown"}`);
		meta.innerHTML = `${dateLabel} ${time} ${area}${linkText} ${enriched.note || ""}`;
		panel.hidden = false;
		return false;
	}

	const { speechBlock, checklistBlock } = buildOutputBlocks(enriched.records);
	setOutputTextareaValue(notionTitleArea, notionTitle);
	setOutputTextareaValue(speechCode, speechBlock);
	setOutputTextareaValue(checklistCode, checklistBlock);

	const weekdayLabel = toWeekdayToggleLabel(badgeEl.dataset.date || "");
	latestFirstMilestoneOutput = {
		event: "first-milestone-import",
		version: 1,
		requestId: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
		generatedAt: new Date().toISOString(),
		lessonTitle: notionTitle,
		notionTitle,
		weekdayLabel,
		area: area || "",
		date: badgeEl.dataset.date || "",
		time: time || "",
		statusUrl: lessonLink || "",
		speechBlock,
		checklistBlock,
	};
	window.VIZ.getLatestFirstMilestoneOutput = () =>
		cloneJsonValue(latestFirstMilestoneOutput);
	notionImportBtn.disabled = false;

	const copied = await copyBothBlocksToClipboard(speechBlock, checklistBlock);
	const copyText = copied
		? "（2ブロックをクリップボードへコピー済み）"
		: "（コピー失敗: 手動でコピーしてください）";
	meta.innerHTML = `${dateLabel} ${time} ${area}${copyText}${linkText} ${enriched.note || ""}`;

	panel.hidden = false;
	return true;
}

async function handleLastMilestoneClick(badgeEl) {
	const lastStudents = parseJsonArray(badgeEl.dataset.lastStudents);
	if (!lastStudents.length) return false;

	const date = badgeEl.dataset.date || "";
	const time = badgeEl.dataset.time || "";
	const course = badgeEl.dataset.course || "";
	const contextKey = lastMilestoneContextKey(date, time, course);
	const context = lastMilestoneContextMap.get(contextKey) || {
		slotStudentHistories: [],
	};

	const records = buildLastMeetingRecords(
		lastStudents,
		context.slotStudentHistories || [],
	);
	if (!records.length) return false;

	const enriched = await enrichLastMeetingRecordsWithGemini(records);
	const panel = ensureLastMilestoneOutputPanel();
	if (!panel) return false;
	const firstPanel = document.getElementById("viz-milestone-output");
	if (firstPanel) firstPanel.hidden = true;

	const commentArea = panel.querySelector("#viz-last-output-comment");
	const strengthArea = panel.querySelector("#viz-last-output-strengths");
	const meta = panel.querySelector("#viz-last-output-meta");
	const promptCopyBtn = panel.querySelector("#viz-last-copy-prompt-btn");
	const pathCopyBtn = panel.querySelector("#viz-last-copy-json-path-btn");
	if (
		!commentArea ||
		!strengthArea ||
		!meta ||
		!(promptCopyBtn instanceof HTMLElement) ||
		!(pathCopyBtn instanceof HTMLElement)
	) {
		return false;
	}

	const { commentBlock, strengthBlock } = buildGraduationOutputBlocks(
		enriched.records,
	);
	setOutputTextareaValue(commentArea, commentBlock);
	setOutputTextareaValue(strengthArea, strengthBlock);
	const promptText = buildGraduationPrompt(records);
	promptCopyBtn.dataset.copyValue = promptText;
	pathCopyBtn.dataset.copyValue = LAST_MILESTONE_JSON_ABS_PATH;

	const jsonSnapshot = buildLastMilestoneCommentsSnapshot({ badgeEl, records });
	const writeTriggered = writeLastMilestoneCommentsJson(jsonSnapshot);

	const copied = await copyBothBlocksToClipboard(commentBlock, strengthBlock);
	const area = badgeEl.dataset.area || "";
	const dateLabel = toDateLabel(date);
	const lessonLink = badgeEl.dataset.statusUrl || "";
	const linkText = lessonLink
		? ` / LMS: <a href="${lessonLink}" target="_blank" rel="noopener noreferrer">▶</a>`
		: "";
	const copyText = copied
		? "（2ブロックをクリップボードへコピー済み）"
		: "（コピー失敗: 手動でコピーしてください）";
	const jsonNote = writeTriggered
		? ` / JSON: ${LAST_MILESTONE_JSON_ABS_PATH}`
		: " / JSON保存準備に失敗";
	meta.innerHTML = `${dateLabel} ${time} ${area}${copyText}${linkText}${jsonNote} ${enriched.note || ""}`;

	panel.hidden = false;
	return true;
}

/**
 * エントリポイント
 */
(function boot() {
	if (typeof VISUALIZER_DATA === "undefined") return;

	lastMilestoneContextMap = buildLastMilestoneContextMap(VISUALIZER_DATA);
	renderScheduleTable(VISUALIZER_DATA, { orphanSheetUrl: ORPHAN_SHEET_URL });
	applyVisitedStyles();
	scrollToToday({ anchor: 0.2 });
})();

/**
 * 全体のクリック監視
 */
document.addEventListener("click", (e) => {
	const target = e.target;
	const lastCollapseBtn = target.closest?.("#viz-last-output-collapse-btn");
	if (lastCollapseBtn) {
		e.preventDefault();
		e.stopPropagation();
		const panel = document.getElementById("viz-last-output");
		if (panel) {
			const isCollapsed = panel.classList.contains("is-collapsed");
			setLastMilestoneOutputPanelCollapsed(panel, !isCollapsed);
		}
		return;
	}
	const collapseBtn = target.closest?.("#viz-output-collapse-btn");
	if (collapseBtn) {
		e.preventDefault();
		e.stopPropagation();
		const panel = document.getElementById("viz-milestone-output");
		if (panel) {
			const isCollapsed = panel.classList.contains("is-collapsed");
			setMilestoneOutputPanelCollapsed(panel, !isCollapsed);
		}
		return;
	}
	const notionImportBtn = target.closest?.("#viz-output-notion-import-btn");
	if (notionImportBtn) {
		e.preventDefault();
		e.stopPropagation();
		requestFirstMilestoneNotionImport();
		return;
	}
	const outputCopyBtn = target.closest?.(".viz-output-copy-btn");
	if (outputCopyBtn) {
		e.preventDefault();
		e.stopPropagation();
		const directText = String(outputCopyBtn.dataset.copyValue || "");
		if (directText) {
			void copyTextToClipboard(directText).then((ok) => {
				if (ok) showOutputCopyToast(outputCopyBtn);
			});
			return;
		}
		const targetId = String(outputCopyBtn.dataset.copyTarget || "");
		void copyOutputTextareaById(targetId).then((ok) => {
			if (ok) showOutputCopyToast(outputCopyBtn);
		});
		return;
	}
	const firstBadge = target.closest?.(".badge-first");
	if (firstBadge) {
		e.preventDefault();
		e.stopPropagation();
		void handleFirstMilestoneClick(firstBadge);
		return;
	}
	const lastBadge = target.closest?.(".badge-last");
	if (lastBadge) {
		e.preventDefault();
		e.stopPropagation();
		void handleLastMilestoneClick(lastBadge);
		return;
	}

	const statusLink = target.closest?.(".status-link");
	if (statusLink) {
		// ダブルクリック判定のためシングル実行を遅らせる
		e.preventDefault();
		e.stopPropagation();

		const existingTimer = statusClickTimers.get(statusLink);
		if (existingTimer) clearTimeout(existingTimer);

		if (e.detail > 1) return; // ダブルクリック時は dblclick ハンドラで処理

		const timerId = window.setTimeout(() => {
			openStatusLinkOnce(statusLink.href, statusLink);
			statusClickTimers.delete(statusLink);
		}, 200);
		statusClickTimers.set(statusLink, timerId);
		return;
	}

	const manualOpened = openManualPendingMaterial(target);
	if (manualOpened) {
		e.preventDefault();
		e.stopPropagation();
		return;
	}

	const urls = getTargetUrls(target);

	// 1. Command/Ctrl + クリック：両方開く
	if (urls && (e.metaKey || e.ctrlKey)) {
		e.preventDefault();
		e.stopPropagation();

		openMultipleUrls(urls);
		return;
	}

	// 2. Notionボタンを通常クリックした場合
	const el = target instanceof Element ? target : target?.parentElement;
	const notionBtn = el?.closest?.(".material-notion-btn");
	if (notionBtn && urls?.notionUrl) {
		e.preventDefault();
		e.stopPropagation();

		// ダブルクリック判定のため、シングルは少し遅らせて実行
		const existingTimer = notionClickTimers.get(notionBtn);
		if (existingTimer) {
			// detail>1 の2回目クリック時などでここに入ったらキャンセル
			clearTimeout(existingTimer);
		}

		if (e.detail > 1) {
			// ダブルクリック時はここでは何もしない（dblclickハンドラでNotionのみ開く）
			return;
		}

		const timerId = window.setTimeout(() => {
			// 通常クリックは Notion + 資料(P5) を両方開く
			openMultipleUrls(urls);
			notionClickTimers.delete(notionBtn);
		}, 200);
		notionClickTimers.set(notionBtn, timerId);
		return;
	}

	// 2b. P5ボタンを通常クリックした場合
	const p5Btn = el?.closest?.(".material-p5-btn");
	if (p5Btn && urls?.p5Url) {
		e.preventDefault();
		openWithProfile(urls.p5Url, "Wonder Gym（P5）");
		return;
	}

	// 3. 通常のリンク処理
	const a = target.closest?.("a");
	if (!a) return;

	const href = a.getAttribute("href");
	if (!href || !href.startsWith("http")) return;
	if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

	// 職人たちに判定を任せ、適切なアクションを命じる
	if (isP5TargetUrl(href)) {
		e.preventDefault();
		markAsVisited(href);
		a.classList.add("is-visited");
		openWithProfile(href, "Wonder Gym（P5）");
	} else if (isChatGPTUrl(href)) {
		e.preventDefault();
		openWithProfile(href, "Default");
	}
});

// 右クリック（コンテキストメニュー）で Notion + 資料を両方開く
document.addEventListener("contextmenu", (e) => {
	const urls = getTargetUrls(e.target);
	if (!urls || (!urls.notionUrl && !urls.materialUrl)) return;

	e.preventDefault();

	openMultipleUrls(urls);
});

// ダブルクリック操作
document.addEventListener("dblclick", (e) => {
	const statusLink = e.target.closest?.(".status-link");
	if (statusLink) {
		e.preventDefault();
		e.stopPropagation();

		const t = statusClickTimers.get(statusLink);
		if (t) clearTimeout(t);
		statusClickTimers.delete(statusLink);

		openStatusLinkWithNotion(statusLink.href);
		return;
	}

	const urls = getTargetUrls(e.target);
	if (!urls || (!urls.notionUrl && !urls.materialUrl)) return;

	e.preventDefault();
	e.stopPropagation();

	// notionボタンクリック待ちタイマーがあればキャンセル
	const el = e.target instanceof Element ? e.target : e.target?.parentElement;
	const notionBtn = el?.closest?.(".material-notion-btn");
	if (notionBtn) {
		const t = notionClickTimers.get(notionBtn);
		if (t) clearTimeout(t);
		notionClickTimers.delete(notionBtn);

			// Notionアイコンのダブルクリックは Notion のみ開く
			if (urls.notionUrl) {
				openWithProfile(urls.notionUrl, "Default");
			}
			return;
		}

	openMultipleUrls(urls);
});
