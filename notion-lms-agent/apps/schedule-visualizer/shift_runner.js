// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/shift_runner.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import puppeteer from "puppeteer";

import { wait } from "../../modules/common/wait.js";
import { loginLms } from "../../modules/lms/auth/loginLms.js";
import { NOTION_VIEW_URL } from "../../modules/notion/scrape/schedule/constants.js";
import { applyTeacherFilter } from "../../modules/notion/internal/scrape/scrapeCommon.js";
import { loadMore } from "../../modules/notion/internal/actions/notionActions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_PATH = path.join(ROOT, "data", "lms_lessons_for_schedules.json");

function normalizeTime(t) {
	const m = String(t || "")
		.trim()
		.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return String(t || "").trim();
	return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function pickSlotLessons(entry) {
	const time = normalizeTime(entry?.time);
	const lessons = Array.isArray(entry?.matchedLessons) ? entry.matchedLessons : [];
	const byStart = lessons.filter((l) => normalizeTime(l?.start) === time);
	if (byStart.length) return byStart;
	return lessons.filter((l) => normalizeTime(l?.end) === time);
}

function computeSlotTeacherStatus(entry) {
	const targetTeacher = (process.env.NAME || "").trim();
	const slotLessons = pickSlotLessons(entry);
	const teacherNames = Array.from(
		new Set(slotLessons.map((l) => String(l?.teacherName || "").trim()).filter(Boolean)),
	);

	if (!slotLessons.length) return "no_row";
	if (!teacherNames.length) return "missing";
	if (targetTeacher && teacherNames.some((n) => n === targetTeacher)) return "matched";
	return "different";
}

function resolveScheduleEditUrl(entry) {
	const slotLessons = pickSlotLessons(entry);
	const bySlot = slotLessons.map((l) => l?.editUrl).filter(Boolean);
	if (bySlot.length) return bySlot[0];

	const fallback =
		entry?.scheduleEditUrl ||
		(Array.isArray(entry?.matchedLessons)
			? entry.matchedLessons.map((l) => l?.editUrl).find(Boolean)
			: null) ||
		null;
	return fallback;
}

function readQueue(limit = 100) {
	if (!fs.existsSync(DATA_PATH)) {
		throw new Error(`lms_lessons_for_schedules.json が見つかりません: ${DATA_PATH}`);
	}
	const all = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
	const normalized = all
		.map((o) => ({
			...o,
			scheduleEditUrl: resolveScheduleEditUrl(o),
			slotTeacherStatus: computeSlotTeacherStatus(o),
		}));

	const queue = normalized
		.filter((o) => o.slotTeacherStatus === "missing" && o.scheduleEditUrl)
		.slice(0, limit);

	const noRow = normalized.filter((o) => o.slotTeacherStatus === "no_row");
	const missingWithoutEdit = normalized.filter(
		(o) => o.slotTeacherStatus === "missing" && !o.scheduleEditUrl,
	);

	return { queue, noRow, missingWithoutEdit };
}

function canSubmitWithEnter(teacherSet) {
	const status = teacherSet?.status || "";
	return status === "set" || status === "already-set" || status === "already-set-target";
}

function buildTeacherNotice(teacherSet) {
	if (!teacherSet || typeof teacherSet !== "object") return null;

	const prev = String(teacherSet.previousSelectedText || "").trim();
	const selected = String(teacherSet.selectedText || teacherSet.teacherName || "").trim();

	if (teacherSet.status === "already-set-target") {
		return `ℹ 講師は既に「${selected || prev}」が選択済みです`;
	}
	if (teacherSet.status === "already-set-other") {
		return prev
			? `⚠ 事前選択は「${prev}」でした（自動では上書きしていません）`
			: "⚠ 事前選択は自分以外でした（自動では上書きしていません）";
	}
	if (teacherSet.status === "set") {
		if (!prev) {
			return `⚠ 事前選択は未記入でした → 「${selected}」を設定しました`;
		}
		if (selected && prev !== selected) {
			return `⚠ 事前選択は「${prev}」でした → 「${selected}」に変更しました`;
		}
		return `ℹ 「${selected}」を設定しました`;
	}
	return null;
}

function buildPromptText(entry, teacherSet) {
	const time = `${entry.date} ${entry.time}`;
	if (canSubmitWithEnter(teacherSet)) {
		return `Ready: ${time} ${entry.course}\nENTER=送信 / s=skip / q=quit > `;
	}
	const reason = teacherSet?.status || "unknown";
	return `Ready: ${time} ${entry.course}\n講師の自動設定が未完了 (${reason}) / f=強制送信 / s=skip / q=quit > `;
}

function createRl() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
}

async function promptAction(rl, text) {
	return await new Promise((resolve) => {
		rl.question(text, (ans) => resolve(ans.trim()));
	});
}

async function autoSelectTeacher(page) {
	return await page.evaluate(() => {
		const normalize = (v) =>
			String(v || "")
				.replace(/\u3000/g, " ")
				.replace(/\s+/g, "")
				.trim();
		const equalsLoose = (a, b) => {
			const x = normalize(a);
			const y = normalize(b);
			return x && y && (x === y || x.includes(y) || y.includes(x));
		};
		const isPlaceholder = (v) => /選択|未選択|未設定|choose|---|なし/i.test(String(v || "").trim());

		const nameButton = Array.from(document.querySelectorAll("button")).find((b) =>
			(b.textContent || "").includes(" さん"),
		);
		if (!nameButton) return { status: "name-missing" };

		const teacherName = (nameButton.textContent || "").replace(" さん", "").trim();
		if (!teacherName) return { status: "name-empty" };

		let select =
			document.querySelector('select[name="lecturer_user_id"]') ||
			document.querySelector('select[name*="teacher"][name*="id"]') ||
			document.querySelector('select[id*="teacher"][id*="id"]') ||
			document.querySelector('select[name*="lecturer"][name*="id"]') ||
			document.querySelector('select[id*="lecturer"][id*="id"]');

		if (!select) {
			select = Array.from(document.querySelectorAll("select")).find((s) =>
				Array.from(s.options || []).some((o) => equalsLoose(o.textContent || "", teacherName)),
			);
		}
		if (!select) return { status: "select-missing", teacherName };

		const selectedOptionBefore =
			select.options?.[select.selectedIndex] ||
			Array.from(select.options || []).find((o) => o.value === select.value) ||
			null;
		const previousSelectedText = (selectedOptionBefore?.textContent || "").trim();
		if (select.value && select.value !== "" && !isPlaceholder(previousSelectedText)) {
			if (equalsLoose(previousSelectedText, teacherName)) {
				return {
					status: "already-set-target",
					teacherName,
					previousSelectedText,
					selectedText: previousSelectedText,
				};
			}
			return {
				status: "already-set-other",
				teacherName,
				previousSelectedText,
				selectedText: previousSelectedText,
			};
		}

		const option = Array.from(select.options || []).find(
			(o) => equalsLoose(o.textContent || "", teacherName),
		);
		if (!option) {
			return {
				status: "option-not-found",
				teacherName,
				previousSelectedText,
			};
		}

		select.value = option.value;
		select.dispatchEvent(new Event("input", { bubbles: true }));
		select.dispatchEvent(new Event("change", { bubbles: true }));
		const selectedOptionAfter =
			select.options?.[select.selectedIndex] ||
			Array.from(select.options || []).find((o) => o.value === select.value) ||
			null;
		const selectedText = (selectedOptionAfter?.textContent || "").trim();
		return {
			status: "set",
			teacherName,
			previousSelectedText,
			selectedText: selectedText || teacherName,
		};
	});
}

async function highlightInfo(page) {
	await page.evaluate(() => {
		function highlightByLabel(label) {
			const p = Array.from(document.querySelectorAll("p.font-bold")).find(
				(el) => (el.textContent || "").trim() === label,
			);
			if (!p) return false;
			const val = p.parentElement?.querySelector("p.mx-4");
			if (!val) return false;
			val.scrollIntoView({ block: "center" });
			val.style.outline = "3px solid #f59e0b";
			val.style.background = "rgba(255,243,205,0.8)";
			return true;
		}

		highlightByLabel("支部名");
		highlightByLabel("開始日時");
		highlightByLabel("講師");
	});
}

async function openNotionPreview(browser) {
	try {
		const page = await browser.newPage();
		await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
		await wait(1500);
		const ok = await applyTeacherFilter(page);
		if (!ok) {
			console.warn("⚠ 講師フィルタが適用できませんでした（Notionプレビュー）");
		}
		await loadMore(page);
		console.log("ℹ Notionプレビューを表示します（シフト処理中）");
		return page;
	} catch (e) {
		console.warn("⚠ Notion プレビューの準備に失敗しました", e);
		return null;
	}
}

function buildLaunchOptions(profileDirectory) {
	const args = ["--start-maximized"];
	if (profileDirectory) {
		args.push(`--profile-directory=${profileDirectory}`);
	}
	return {
		headless: false,
		defaultViewport: null,
		args,
	};
}

export async function runShiftAssigner({
	shiftMode = "run", // 送信ありのみ残す（実質 "run" 固定だが将来拡張余地）
	openNotionDuringShift = false,
	keepBrowserOpen = false,
	profileDirectory = null,
	browser: existingBrowser = null,
	notionPage: existingNotionPage = null,
} = {}) {
	const { queue, noRow, missingWithoutEdit } = readQueue(100);

	if (noRow.length || missingWithoutEdit.length) {
		console.warn("⚠ 自動登録できない枠があります（LMS側の行未生成または編集URLなし）");
		const unresolved = noRow.concat(missingWithoutEdit);
		for (const entry of unresolved) {
			console.warn(
				`  - ${entry.date}|${entry.time}|${entry.area}|${entry.month} (${entry.slotTeacherStatus})`,
			);
			console.warn(`    lmsUrl: ${entry.lmsUrl || "-"}`);
		}
	}

	if (!queue.length) {
		console.log("✅ teacherStatus=missing のデータはありません");
		if (noRow.length || missingWithoutEdit.length) {
			console.log(
				"ℹ LMSに該当コマが出現した後に、`node apps/schedule-visualizer/index.js --shift-only` を再実行してください。",
			);
		}
		return;
	}

	console.log(`▶ 未設定 ${queue.length} 件を処理します (${shiftMode})`);

	const browser =
		existingBrowser || (await puppeteer.launch(buildLaunchOptions(profileDirectory)));

	let notionPage = existingNotionPage || null;
	if (notionPage) {
		console.log("ℹ Notionタブを再利用します（再選択を省略）");
	}
	if (!notionPage && (openNotionDuringShift || keepBrowserOpen)) {
		notionPage = await openNotionPreview(browser);
	}

	const page = await browser.newPage();
	await loginLms(page);

	const rl = createRl();

	for (const entry of queue) {
		console.log("─────────────────────────");
		console.log(`📅 ${entry.date} ${entry.time} / ${entry.course}`);
		console.log(entry.scheduleEditUrl);

		await page.goto(entry.scheduleEditUrl, { waitUntil: "networkidle2" });
		await wait(600);

		const teacherSet = await autoSelectTeacher(page);
		console.log("👤 teacher:", teacherSet);
		const teacherNotice = buildTeacherNotice(teacherSet);
		if (teacherNotice) {
			console.log(teacherNotice);
		}

		await highlightInfo(page);

		let action = "";
		while (true) {
			action = await promptAction(rl, buildPromptText(entry, teacherSet));
			const enterAllowed = canSubmitWithEnter(teacherSet);
			if (enterAllowed && (action === "" || action === "s" || action === "q")) break;
			if (!enterAllowed && (action === "f" || action === "s" || action === "q")) break;
			if (!enterAllowed && action === "") {
				console.warn(
					"⚠ 講師が自動設定できていません。画面で講師を手動確認してから f を押してください。",
				);
			}
		}

		if (action === "q") {
			console.log("⏹ 中断します");
			break;
		}
		if (action === "s") {
			console.log("⏭ スキップ");
			continue;
		}

		// ENTER or f → 送信
		const submitClicked = await page.evaluate(() => {
			const btn = document.querySelector(
				'input.admin-indigo-button[type="submit"]',
			);
			if (!btn) return false;
			btn.scrollIntoView({ block: "center" });
			btn.classList.add("ring-4", "ring-amber-400");
			btn.click();
			return true;
		});

		if (!submitClicked) {
			console.warn("⚠ 送信ボタンが見つかりませんでした。手動で対応してください。");
			continue;
		}

		console.log("⏳ 送信しています… (成功アラートを待機)");
		try {
			await page.waitForSelector("#alert-success", { timeout: 0 });
			console.log("✅ 成功アラートを検出 → 次へ");
		} catch (e) {
			console.warn("⚠ 成功アラートが出ませんでした。手動確認してください。");
			break;
		}
	}

	rl.close();

	if (!keepBrowserOpen) {
		await page.close().catch(() => {});
		if (notionPage) await notionPage.close().catch(() => {});
		await browser.close().catch(() => {});
	} else {
		console.log("ℹ keep-browser-open: ブラウザは開いたままにします");
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runShiftAssigner().catch((e) => {
		console.error("❌ shift_runner failed");
		console.error(e);
		process.exit(1);
	});
}
