// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/ui/scroll.js
import { buildMonthlyIndex } from "../lib/buildMonthlyIndex.js";
import {
	openWithProfile,
	runPasteCommand,
} from "../interactions/shortcut_actions.js";

export function scrollToToday({ anchor = 0.2 } = {}) {
	const container = document.getElementById("table-container");
	if (!container) return;

	const headers = Array.from(
		document.querySelectorAll("th.date-header[data-date]"),
	);
	if (!headers.length) return;

	const now = new Date();
	const yyyy = String(now.getFullYear());
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const dd = String(now.getDate()).padStart(2, "0");
	const todayStr = `${yyyy}-${mm}-${dd}`;

	let target = headers.find((h) => h.dataset.date === todayStr);
	if (!target) {
		target =
			headers.find((h) => h.dataset.date > todayStr) ||
			headers[headers.length - 1];
	}
	if (!target) return;

	const cRect = container.getBoundingClientRect();
	const tRect = target.getBoundingClientRect();

	// 既存の挙動：左寄せ気味（anchor=0.2）
	const offset = tRect.left - cRect.left - cRect.width * anchor;
	container.scrollLeft += offset;
}

export function scrollToSlot({
	date,
	time,
	anchorX = 0.2,
	anchorY = 0.3,
	highlight = false,
	fallbackEl = null,
} = {}) {
	if (!date || !time) return false;

	const container = document.getElementById("table-container");
	const root = container || document;

	let cell =
		root.querySelector(`td[data-date="${date}"][data-time="${time}"]`) ||
		fallbackEl?.closest?.("td");

	if (!cell) {
		const header = root.querySelector(`th.date-header[data-date="${date}"]`);
		const timeRow = Array.from(root.querySelectorAll("tr")).find((tr) => {
			const text = tr.querySelector(".time-col")?.textContent?.trim();
			return text && text.startsWith(time);
		});

		if (header && container) {
			const targetLeft =
				header.offsetLeft - container.clientWidth * anchorX + header.clientWidth / 2;
			const targetBase = timeRow || header;
			const targetTop =
				targetBase.offsetTop - container.clientHeight * anchorY + targetBase.clientHeight / 2;

			container.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });

			console.log("[scrollToSlot] cell not found, scrolled to header/row", {
				date,
				time,
				targetLeft,
				targetTop,
				rowFound: Boolean(timeRow),
			});

			if (highlight) {
				(header || timeRow)?.classList.add("jump-highlight");
				window.setTimeout(
					() => (header || timeRow)?.classList.remove("jump-highlight"),
					1600,
				);
			}
			return true;
		}

		console.warn("[scrollToSlot] cell not found", { date, time });
		return false;
	}

	if (container && container.contains(cell)) {
		// --- 横方向（container 内スクロールを直接指定） ---
		const targetLeft =
			cell.offsetLeft - container.clientWidth * anchorX + cell.clientWidth / 2;
		const targetTop =
			cell.offsetTop - container.clientHeight * anchorY + cell.clientHeight / 2;

		container.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });

		console.log("[scrollToSlot] scrolled", {
			date,
			time,
			targetLeft,
			targetTop,
			offsetLeft: cell.offsetLeft,
			offsetTop: cell.offsetTop,
			containerScrollLeft: container.scrollLeft,
			containerScrollTop: container.scrollTop,
		});
	} else {
		// フォールバック：通常の scrollIntoView
		cell.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "center",
		});
		console.log("[scrollToSlot] scrollIntoView fallback", { date, time });
	}

	if (highlight) {
		cell.classList.add("jump-highlight");
		window.setTimeout(() => cell.classList.remove("jump-highlight"), 1600);
	}

	return true;
}
export function setupMonthScrollIndicator(tableEl) {
	const container = document.getElementById("table-container");
	const monthLabelEl = document.getElementById("month-floating-label");

	if (!container || !monthLabelEl || !tableEl) return;

	const MONTH_NOTION_URL = "https://www.notion.so/YOUR_MONTH_VIEW_ID";
	const SLACK_ACTIVITY_INBOX_URL =
		"https://app.slack.com/client/T044L4SN63T/activity-inbox";
	const NOTION_PREVIEW_COMMAND =
		"node /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/index.js --notion-preview";
	const VISUALIZER_WEEK_COMMAND =
		"node /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/index.js week";
	const VISUALIZER_ALL_SHIFT_COMMAND =
		"node /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/index.js all --notion --shift --open-notion-during-shift";

	const headers = Array.from(
		tableEl.querySelectorAll("thead tr:nth-child(2) th.date-header"),
	);
	if (!headers.length) return;

	// ==================================================
	// ② 月別インデックス構築（1回だけ）
	// ==================================================
	const allSchedules = [
		...(window.VISUALIZER_DATA?.mine || []),
		...(window.VISUALIZER_DATA?.past || []),
	];

	const monthlyScheduleMap = buildMonthlyIndex(allSchedules, {});

	const monthlyOrphanMap = buildMonthlyIndex(
		window.ORPHAN_VISUALIZER_DATA || [],
		{},
	);

	// ==================================================
	// ③ ラベル更新（軽量処理のみ）
	// ==================================================
	function updateMonthLabel() {
		const cRect = container.getBoundingClientRect();
		const centerCandidates = [];

		headers.forEach((header) => {
			const rect = header.getBoundingClientRect();
			const centerX = (rect.left + rect.right) / 2;
			if (centerX >= cRect.left && centerX <= cRect.right) {
				centerCandidates.push(header);
			}
		});

		let targetHeader = null;
		if (centerCandidates.length >= 2) targetHeader = centerCandidates[1];
		else if (centerCandidates.length === 1) targetHeader = centerCandidates[0];
		else targetHeader = headers[0];

		const dateStr = targetHeader.dataset.date;
		const year = Number(dateStr.slice(0, 4));
		const monthNum = Number(dateStr.slice(5, 7));

		const key = `${year}-${String(monthNum).padStart(2, "0")}`;

		const totalSlots = monthlyScheduleMap[key]?.length || 0;
		const orphanCount = monthlyOrphanMap[key]?.length || 0;

		monthLabelEl.innerHTML = `
			<span class="month-label-text">${monthNum}月：schedule ${totalSlots}, orphan ${orphanCount}</span>
			<button type="button" class="month-label-paste" aria-label="NotionをPasteCommandで開く" data-tooltip="・Notion(シフト)を開く">
				<img src="https://cdn.simpleicons.org/notion/ffffff" alt="Notion" class="month-label-icon" />
			</button>
				<a class="month-label-link" href="${MONTH_NOTION_URL}" target="_blank" rel="noopener noreferrer" aria-label="Notionで開く">
				<span aria-hidden="true">💬</span>
			</a>
				<button
					type="button"
					class="month-label-week-run month-label-slack-open"
					aria-label="Slack Activity InboxをDefaultで開く"
					data-tooltip="・Slackを開く&#10;・Defaultプロフィールで起動"
				>
				<img src="https://a.slack-edge.com/cebaa/img/ico/favicon.ico" alt="Slack" class="month-label-icon" />
			</button>
			<button
				type="button"
				class="month-label-week-run month-label-week-only"
				aria-label="PasteCommandで±7日更新を実行"
				data-tooltip="・振替授業登録&#10;・以前のコメントステータス更新"
			>
				<span aria-hidden="true">±7(➡️)</span>
			</button>
				<button
					type="button"
					class="month-label-week-run month-label-all-shift-run"
					aria-label="PasteCommandでall --notion --shift --open-notion-during-shiftを実行"
					data-tooltip="・Notion scrape&#10;・シフト登録"
				>
				<span aria-hidden="true">🚀</span>
			</button>
		`;

		const pasteBtn = monthLabelEl.querySelector(".month-label-paste");
		if (pasteBtn) {
			pasteBtn.onclick = () => {
				runPasteCommand(NOTION_PREVIEW_COMMAND, "PasteCommand");
			};
		}

			const monthLink = monthLabelEl.querySelector(".month-label-link");
			if (monthLink) {
				monthLink.onclick = (e) => {
					e.preventDefault();
					openWithProfile(MONTH_NOTION_URL, "Default");
				};
			}

		const weekRunBtn = monthLabelEl.querySelector(".month-label-week-only");
		if (weekRunBtn) {
			weekRunBtn.onclick = () => {
				runPasteCommand(VISUALIZER_WEEK_COMMAND, "PasteCommand");
			};
		}

		const allShiftRunBtn = monthLabelEl.querySelector(".month-label-all-shift-run");
		if (allShiftRunBtn) {
			allShiftRunBtn.onclick = () => {
				runPasteCommand(VISUALIZER_ALL_SHIFT_COMMAND, "PasteCommand");
			};
		}

			const slackOpenBtn = monthLabelEl.querySelector(".month-label-slack-open");
			if (slackOpenBtn) {
				slackOpenBtn.onclick = () => {
					openWithProfile(SLACK_ACTIVITY_INBOX_URL, "Default");
				};
			}
	}

	// ==================================================
	// ④ scrollイベント登録
	// ==================================================
	let ticking = false;

	container.addEventListener("scroll", () => {
		if (!ticking) {
			window.requestAnimationFrame(() => {
				updateMonthLabel();
				ticking = false;
			});
			ticking = true;
		}
	});
	updateMonthLabel();
}
