// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/notion/internal/scrape/scrapeCommon.js
// ---------- .env 読み込み（1つ上の階層）----------
import { loadParentEnv } from "../../../common/loadEnv.js";
loadParentEnv(import.meta.url);

// ----------------------------------------------------

import { wait } from "../../../common/wait.js";
import {
	clickToggle,
	loadMore,
	extractTimelineCards,
	extractDetailPage,
} from "../actions/notionActions.js";

import {
	openFilterMenu,
	clickAddFilter,
	selectPropertyTeacher,
	chooseTeacherName,
	clickDatePill,
} from "../actions/filterActions.js";

// ← .env から読み込まれた値（NAME=◯◯）
const TARGET_TEACHER = process.env.NAME;
const TEACHER_TOGGLE_TIMEOUT_MS = Number(process.env.NOTION_TOGGLE_WAIT_MS || "0");

// ----------------------------------------------------
export async function applyTeacherFilter(page) {
	if (!TARGET_TEACHER) {
		throw new Error("[filter] process.env.NAME が未設定です");
	}

	const toggleOk = await clickToggle(page, "講師別(週間)", {
		timeoutMs: TEACHER_TOGGLE_TIMEOUT_MS,
	});
	if (!toggleOk) {
		throw new Error("[filter] トグル『講師別(週間)』が見つかりません");
	}
	await wait(800);

	const filterOk = await openFilterMenu(page);
	if (!filterOk) {
		throw new Error("[filter] フィルターアイコンが押せません");
	}
	await wait(250);

	const addFilterOk = await clickAddFilter(page);
	if (!addFilterOk) {
		throw new Error("[filter] ＋フィルターが押せません");
	}
	await wait(250);

	const propOk = await selectPropertyTeacher(page);
	if (!propOk) {
		throw new Error("[filter] 講師プロパティが選択できません");
	}

	await wait(300);

	const ok = await chooseTeacherName(page, TARGET_TEACHER);
	await wait(600);
	if (!ok) {
		throw new Error(`[filter] 講師名『${TARGET_TEACHER}』が選択できません`);
	}

	return ok;
}

async function findAndClickRoleButton(
	page,
	label,
	predicate,
	{ timeoutMs = 7000 } = {},
) {
	console.log(`🔍 ${label} を探しています...`);

	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const handle = await page.evaluateHandle((predStr) => {
			const pred = new Function("t", `return (${predStr})(t);`);
			const nodes = [...document.querySelectorAll('div[role="button"]')];

			const found = nodes.find((el) => {
				const t = (el.innerText || "").trim();
				return pred(t);
			});

			return found || null;
		}, predicate.toString());

		const el = handle.asElement();
		if (el) {
			const box = await el.boundingBox();
			if (box) {
				await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
				console.log(`✅ ${label} をクリックしました`);
				return true;
			}
			console.log(
				`❌ ${label} は見つかったが boundingBox が取れませんでした（非表示の可能性）`,
			);
			return false;
		}

		await wait(250);
	}

	// タイムアウト時：参考情報を出す（何が並んでるか）
	const sample = await page.evaluate(() => {
		return [...document.querySelectorAll('div[role="button"]')]
			.map((el) => (el.innerText || "").trim())
			.filter(Boolean)
			.slice(0, 40);
	});
	console.log(`❌ ${label} が見つかりませんでした`);
	console.log("🔎 buttons sample:", sample);

	return false;
}

export async function switchToPast(page) {
	console.log(
		"=== DEBUG: set date range (start=prev month 1st, end=+2 months included) ===",
	);

	// 1) 日付レンジボタンをクリック
	console.log("🔍 日付レンジボタン（'日付' と '→' を含む）を探しています...");
	const handle = await page.evaluateHandle(() => {
		const btn = [...document.querySelectorAll('div[role="button"]')].find(
			(b) => {
				const t = (b.innerText || "").trim();
				return t.includes("日付") && t.includes("→");
			},
		);
		return btn || null;
	});

	const el = handle.asElement();
	if (!el) {
		throw new Error("[range] 日付レンジボタンが見つかりませんでした");
	}

	const box = await el.boundingBox();
	if (!box) {
		throw new Error(
			`[ui] ${label} は見つかったが boundingBox が取得できません`,
		);
	}

	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	console.log("✅ 日付レンジボタンをクリックしました");

	// 2) ダイアログ待機
	console.log("🔍 日付ダイアログ（role=dialog）を待っています...");
	await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
	console.log("✅ 日付ダイアログを検出しました");

	// 3) 開始日 input（activeElement）から “今月の開始日” を読む
	const startActive = await page.evaluate(() => {
		const el = document.activeElement;
		return {
			tag: el?.tagName || null,
			value: el?.tagName === "INPUT" ? el.value : null,
		};
	});
	console.log("🎯 start activeElement:", startActive);

	if (startActive.tag !== "INPUT" || !startActive.value) {
		throw new Error("[range] 開始日 input が取得できません");
	}

	// ---- util
	function parseYMD(s) {
		const m = String(s).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
		if (!m) return null;
		return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
	}
	function fmtYMD(y, m, d) {
		return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
	}
	function prevMonthFirst(ymdStr) {
		const p = parseYMD(ymdStr);
		if (!p) return null;
		let y = p.y;
		let mo = p.m - 1;
		if (mo === 0) {
			mo = 12;
			y -= 1;
		}
		return fmtYMD(y, mo, 1);
	}
	function addMonthsFirstDay(ymdStr, addMonths) {
		const p = parseYMD(ymdStr);
		if (!p) return null;
		let y = p.y;
		let mo = p.m + addMonths;
		while (mo > 12) {
			mo -= 12;
			y += 1;
		}
		while (mo <= 0) {
			mo += 12;
			y -= 1;
		}
		return fmtYMD(y, mo, 1);
	}

	// 4) 日付レンジ計算
	//    start: 前月1日
	//    end  : “今月の1日”から +3ヶ月の1日（= 今月+2ヶ月を含む）
	const newStart = prevMonthFirst(startActive.value);
	const newEnd = addMonthsFirstDay(startActive.value, 2);

	if (!newStart || !newEnd) {
		throw new Error(`[range] 日付計算失敗 base=${startActive.value}`);
	}

	console.log("🧾 入力する開始日:", newStart);
	console.log("🧾 入力する終了日:", newEnd);

	// 5) 開始日：DOMで強制クリア→type（Enterは押さない）
	console.log("⌨️ 開始日をDOMで強制クリア→入力...");
	await page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el.tagName !== "INPUT") return;
		el.focus();
		const proto = Object.getPrototypeOf(el);
		const desc = Object.getOwnPropertyDescriptor(proto, "value");
		const setValue = desc?.set;
		if (setValue) setValue.call(el, "");
		else el.value = "";
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await page.keyboard.type(newStart, { delay: 15 });
	await wait(120);

	// 6) 終了日：Tab 2回で移動
	console.log("➡️ TABで終了日inputへ移動します（2回）...");
	async function logActive(page, label) {
		const v = await page.evaluate(() => {
			const el = document.activeElement;
			return {
				tag: el?.tagName,
				value: el?.value,
				placeholder: el?.placeholder,
				name: el?.getAttribute?.("name"),
			};
		});
		console.log(label, v);
	}

	// -----

	await logActive(page, "🎯 before TAB");

	await page.keyboard.press("Tab");
	await wait(80);
	await logActive(page, "🎯 after TAB 1");

	await page.keyboard.press("Tab");
	await wait(150);
	await logActive(page, "🎯 after TAB 2");

	const endActive = await page.evaluate(() => {
		const el = document.activeElement;
		return {
			tag: el?.tagName || null,
			value: el?.tagName === "INPUT" ? el.value : null,
		};
	});
	console.log("🎯 end activeElement:", endActive);

	// 7) 終了日：DOMで強制クリア→type
	console.log("⌨️ 終了日をDOMで強制クリア→入力...");
	await page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el.tagName !== "INPUT") return;
		el.focus();
		const proto = Object.getPrototypeOf(el);
		const desc = Object.getOwnPropertyDescriptor(proto, "value");
		const setValue = desc?.set;
		if (setValue) setValue.call(el, "");
		else el.value = "";
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await page.keyboard.type(newEnd, { delay: 15 });
	await wait(150);
	// ★ ここで Enter を押す
	await page.keyboard.press("Enter");
	await wait(200);
	const endAfter = await page.evaluate(
		() => document.activeElement?.value || "",
	);
	console.log("🧪 終了日入力後 value:", endAfter);

	// 8) いったん観測停止（必要なら外してOK）
	console.log(
		"🛑 DEBUG: 日付レンジ設定完了。画面確認してください（Enterで続行）",
	);
}

// ----------------------------------------------------
// タイムラインカード → パース済みオブジェクト配列にする共通ヘルパー
// withDetail = true のときだけ extractDetailPage を呼ぶ
async function buildTimelineResults(
	rawTimeline,
	detailScrapePage,
	parseFns,
	{ withDetail },
) {
	const results = [];

	for (const item of rawTimeline) {
		const parsed = parseFns.parseRaw(item.raw);
		const courseParts = parseFns.parseCourse(parsed.course);
		const date = parseFns.parseDate(parsed.dateRaw, parsed.dayLabel);
		const count = parseFns.parseCount(parsed.countRaw);

		let detail = null;
		if (withDetail) {
			detail = await extractDetailPage(detailScrapePage, item.pageUrl);
			await wait(500);
		}

		const base = {
			course: parsed.course,
			courseParts,
			date,
			count,
			pageUrl: item.pageUrl,
		};

		results.push(withDetail ? { ...base, detail } : base);
	}

	return results;
}

// ----------------------------------------------------
// ① これまで通りの「詳細付き」版（schedules.json 用）
export async function fetchTimelineWithDetail(page, parseFns) {
	await loadMore(page);

	const rawTimeline = await extractTimelineCards(page);

	// 講師/期間を設定済みのタイムラインページは保持し、
	// 詳細ページの巡回は別タブで行う。
	let detailPage = null;
	try {
		const browser = page.browser?.();
		if (browser) {
			detailPage = await browser.newPage();
		}
		const detailScrapePage = detailPage || page;
		return await buildTimelineResults(rawTimeline, detailScrapePage, parseFns, {
			withDetail: true,
		});
	} finally {
		if (detailPage) {
			await detailPage.close().catch(() => {});
		}
	}
}

// ② 新規：detail ページには行かない「light」版
export async function fetchTimelineMetaOnly(page, parseFns) {
	await loadMore(page);

	const rawTimeline = await extractTimelineCards(page);
	return await buildTimelineResults(rawTimeline, page, parseFns, {
		withDetail: false,
	});
}
