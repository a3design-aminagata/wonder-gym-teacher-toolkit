// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/notion/scrape/schedule/past.js

// ---------- .env 読み込み（親階層の .env を拾う）----------
import { loadParentEnv } from "../../../common/loadEnv.js";
loadParentEnv(import.meta.url);
// ---------------------------------------------------------

import { wait } from "../../../common/wait.js";
import { saveJSON } from "../../../common/saveUtils.js";
import { NOTION_VIEW_URL } from "./constants.js";

import {
	clickToggle,
	loadMore,
	extractTimelineCards,
	extractDetailPage,
} from "../../internal/actions/notionActions.js";

import {
	openFilterMenu,
	clickAddFilter,
	selectPropertyTeacher,
	chooseTeacherName,
	clickDatePill,
	waitForInnerText,
} from "../../internal/actions/filterActions.js";

import {
	parseRaw,
	parseCourse,
	parseDate,
	parseCount,
} from "../../internal/parse/parseUtils.js";

const TARGET_TEACHER = (process.env.NAME || "").trim();
const TEACHER_TOGGLE_TIMEOUT_MS = Number(process.env.NOTION_TOGGLE_WAIT_MS || "0");

if (!TARGET_TEACHER) {
	throw new Error("process.env.NAME が未設定です");
}

// 「今後」→「過去」へ切り替える（旧UI: date pill + menu）
async function switchToPastByPill(page) {
	// 1) 日付 pill を開く（filterActions 側に寄せてる想定）
	await clickDatePill(page);
	await wait(300);

	// 2) 「今後」ドロップダウンを開く
	const opened = await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll('div[role="button"]'));
		const btn = btns.find((b) => (b.innerText || "").trim() === "今後");
		if (!btn) return false;
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		return true;
	});

	if (!opened) {
		console.log("❌ 『今後』ボタンが見つからず、過去への切替に失敗しました");
		return false;
	}
	await wait(300);

	// 3) menuitem から「過去」を選択
	const handle = await page.evaluateHandle(() => {
		const items = Array.from(document.querySelectorAll('div[role="menuitem"]'));
		return items.find((i) => (i.innerText || "").trim() === "過去") || null;
	});

	const el = handle.asElement();
	if (!el) {
		console.log("❌ 『過去』メニューが見つかりませんでした");
		return false;
	}

	const box = await el.boundingBox();
	if (!box) {
		console.log(
			"❌ 『過去』メニューは見つかったが boundingBox が取れませんでした",
		);
		return false;
	}

	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await wait(600);

	console.log("✅ 日付フィルターを『過去』に切り替えました");
	return true;
}

export async function scrapeSchedulePast(page) {
	console.log("🌐 Notion を開いています…");
	await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
	await wait(1500);

	// 1) 「講師別(週間)」を開く
	console.log("📌 トグル展開（講師別(週間)）");
	const toggleOk = await clickToggle(page, "講師別(週間)", {
		timeoutMs: TEACHER_TOGGLE_TIMEOUT_MS,
	});
	if (!toggleOk) {
		console.log("❌ トグル『講師別(週間)』が見つからないため中断します");
		process.exitCode = 1;
		return [];
	}
	await wait(700);

	// 2) フィルターメニューを開く
	console.log("📌 フィルターメニューを開く");
	await openFilterMenu(page);
	await wait(400);

	// UI生成待ち（必要なら）
	await waitForInnerText(page, 'div[role="option"]', "", 5000);

	// 3) フィルター追加 → 講師名
	console.log("📌 フィルター追加");
	await clickAddFilter(page);
	await wait(400);

	console.log("📌 プロパティで「講師名」を選択");
	const propOk = await selectPropertyTeacher(page);
	if (!propOk) {
		console.log("❌ プロパティ『講師名』が選べませんでした");
		process.exitCode = 1;
		return [];
	}
	await wait(300);

	console.log(`📌 講師名「${TARGET_TEACHER}」を選択`);
	const ok = await chooseTeacherName(page, TARGET_TEACHER);
	await wait(700);

	if (!ok) {
		console.log("❌ 講師が見つからないので処理を中断します。");
		process.exitCode = 1;
		return [];
	}

	// 4) 日付を「過去」に切り替える（旧UI）
	const switched = await switchToPastByPill(page);
	if (!switched) {
		console.log("❌ 過去切替に失敗したので処理を中断します。");
		process.exitCode = 1;
		return [];
	}

	// 5) loadMore → timeline取得
	await loadMore(page);
	const rawTimeline = await extractTimelineCards(page);
	console.log(`📌 timeline raw count (past): ${rawTimeline.length}`);

	if (!rawTimeline.length) {
		console.log("❌ timeline が 0 件。終了します。");
		process.exitCode = 1;
		return [];
	}

	// 6) 詳細取得込みでパース
	const results = [];

	for (const item of rawTimeline) {
		console.log("🌐 詳細ページを取得:", item.pageUrl);

		const parsed = parseRaw(item.raw);
		const courseParts = parseCourse(parsed.course);
		const date = parseDate(parsed.dateRaw, parsed.dayLabel);
		const count = parseCount(parsed.countRaw);

		const detail = await extractDetailPage(page, item.pageUrl);

		results.push({
			course: parsed.course,
			courseParts,
			date,
			count,
			pageUrl: item.pageUrl,
			detail,
		});

		await wait(500);
	}

	await saveJSON("schedules_past.json", results);
	console.log("🎉 schedules_past.json を保存しました（過去）");

	return results;
}
