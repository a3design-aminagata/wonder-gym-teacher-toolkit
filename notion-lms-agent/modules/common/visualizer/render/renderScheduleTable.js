// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/render/renderScheduleTable.js
/**
 * 1画面分を描画（両方で同じ見た目にする）
 */
import { buildItemsFromVisualizerData } from "../data/buildItems.js";
import {
	getWeekdayJP,
	buildDateRangeFromItems,
	makeTimeScale,
	groupDatesByMonth,
	parseTimeToNumber,
} from "../data/dateUtils.js";
import { getColorClassForKey } from "../utils/color.js";
import {
	scrollToToday,
	setupMonthScrollIndicator,
	scrollToSlot,
} from "../ui/scroll.js";
import { computeCellState } from "../logic/computeCellState.js";
import { renderCellView } from "../view/renderCellView.js";
import { findNotionUrlForMaterial } from "../data/material_notion_map.js";
import { findP5UrlForMaterial } from "../data/material_p5_map.js";

// PATH を明示して node が見つからない問題を防ぐ
const RUNNER_BASE_COMMAND =
	"PATH=/opt/homebrew/bin:/usr/local/bin:$PATH node /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/index.js";
const DEFAULT_SHORTCUT_NAME = "PasteCommand";
let lastRenderedDateStr = null;
let lastRenderContext = null;

// =====================
// Public API
// =====================
export function renderScheduleTable(visualizerData, options = {}) {
	const todayStr = new Date().toLocaleDateString("sv-SE");
	lastRenderedDateStr = todayStr;
	lastRenderContext = { visualizerData, options };

	const { orphanSheetUrl } = options;

	const table = document.getElementById("scheduleTable");
	if (!table) {
		console.error("[visualizer_common] #scheduleTable not found");
		return;
	}

	const items = buildItemsFromVisualizerData(visualizerData);
	console.log(
		"[DEBUG] orphan items IN render",
		items.filter((i) => i.isOrphan),
	);
	if (!items.length) {
		table.innerHTML = "";
		return;
	}

	const courseMaterialsMap = buildCourseMaterialsMap(items);
	window.VIZ_COURSE_MATERIALS = courseMaterialsMap;
	const cellMap = buildCellMap(items);
	const makeupTargetsMap = buildMakeupTargetMap(items);
	const uniqueDates = buildDateRangeFromItems(items);
	const uniqueTimes = makeTimeScale(items);

	// 今日（0:00固定）
	const today = new Date();
	const now = new Date();

	today.setHours(0, 0, 0, 0);

	const monthGroups = groupDatesByMonth(uniqueDates);

	const todayHighlightCutoffHour = findLastClassHourForDate(items, todayStr);

	const thead = buildTableHeader(uniqueDates, monthGroups, todayStr);

	const tbody = buildTableBody({
		uniqueTimes,
		uniqueDates,
		cellMap,
		today,
		now,
		orphanSheetUrl,
		todayStr,
		makeupTargetsMap,
		todayHighlightCutoffHour,
	});

	table.innerHTML = thead + tbody;

	setupMonthScrollIndicator(table);
	setupWarningMarkerHandler(table);
	setupStatusMarkHandler(table);
	setupOrphanBadgeHandler(table);
	setupMaterialsRibbonHover(courseMaterialsMap);
	startCurrentHourTicker(table);
}
function buildCellMap(items) {
	const cellMap = new Map();

	items.forEach((item) => {
		const key = `${item.date}|${item.time}`;
		if (!cellMap.has(key)) {
			cellMap.set(key, []);
		}
		cellMap.get(key).push(item);
	});
	return cellMap;
}

function findLastClassHourForDate(items, dateStr) {
	const todays = items.filter((item) => item.date === dateStr);
	if (!todays.length) return null;
	const hours = todays.map((item) => parseTimeToNumber(item.time));
	return Math.max(...hours);
}

// =====================
// Table Builders
// =====================
function buildTableHeader(uniqueDates, monthGroups, todayStr) {
	let thead = "<thead>";

	// 1行目：月
	thead += "<tr>";
	thead += `<th class="time-col" rowspan="2">時間</th>`;
	monthGroups.forEach((g) => {
		const monthNum = Number(g.month.slice(5, 7));
		thead += `<th class="month-header" colspan="${g.span}">${monthNum}月</th>`;
	});
	thead += "</tr>";

	// 2行目：日付
	thead += "<tr>";
	uniqueDates.forEach((d) => {
		const day = Number(d.slice(8, 10));
		const w = getWeekdayJP(d);
		const wdClass = w === "土" ? "sat" : w === "日" ? "sun" : "";

		const isToday = d === todayStr;

		thead += `
			<th class="date-header ${wdClass} ${isToday ? "is-today" : ""}" data-date="${d}">
				<div class="day">${day}</div>
				<div class="weekday">${w}</div>
			</th>
		`;
	});
	thead += "</tr></thead>";

	return thead;
}

function buildTableBody({
	uniqueDates,
	uniqueTimes,
	cellMap,
	today,
	now,
	orphanSheetUrl,
	todayStr,
	makeupTargetsMap,
	todayHighlightCutoffHour,
}) {
	// ボディ
	let tbody = "<tbody>";

	uniqueTimes.forEach((time) => {
		tbody += `<tr><th class="time-col">${time}</th>`;

		uniqueDates.forEach((date) => {
			const key = `${date}|${time}`;
			const cellItems = cellMap.get(key) || [];

			const isToday =
				date === todayStr &&
				(todayHighlightCutoffHour === null ||
					parseTimeToNumber(time) <= todayHighlightCutoffHour);
			const isCurrentHour = isCurrentHourCell({ date, time, now });

			tbody += renderCell({
				date,
				time,
				cellItems,
				today,
				now,
				orphanSheetUrl,
				isToday,
				isCurrentHour,
				makeupTargets:
					makeupTargetsMap?.get(`${date}T${time}`) ||
					makeupTargetsMap?.get(`${date} ${time}`) ||
					[],
			});
		});

		tbody += "</tr>";
	});
	tbody += "</tbody>";
	return tbody;
}

// =====================
// Cell Rendering
// =====================

function renderCell(params) {
	if (!params.cellItems.length) {
		return `<td data-date="${params.date}" data-time="${params.time}" class="cell empty-cell ${params.isToday ? "is-today" : ""} ${params.isCurrentHour ? "is-current-hour" : ""}"></td>`;
	}

	const state = computeCellState(params);

	return renderCellView({
		cellItems: params.cellItems,
		state,
		orphanSheetUrl: params.orphanSheetUrl,
		today: params.today,
		isToday: params.isToday,
		isCurrentHour: params.isCurrentHour,
		date: params.date,
		time: params.time,
		makeupTargets: params.makeupTargets,
	});
}

function isCurrentHourCell({ date, time, now }) {
	// date: YYYY-MM-DD, time: HH:00 (hourly scale)
	if (!date || !time || !(now instanceof Date)) return false;
	const slotStart = new Date(`${date}T${time}:00`);
	const slotEnd = new Date(slotStart);
	slotEnd.setHours(slotEnd.getHours() + 1);

	return now >= slotStart && now < slotEnd;
}

let currentHourTimerId = null;
let currentHourCell = null;

function rerenderIfDateChanged() {
	const nowDateStr = new Date().toLocaleDateString("sv-SE");
	if (nowDateStr === lastRenderedDateStr) return false;
	if (!lastRenderContext) return false;

	renderScheduleTable(
		lastRenderContext.visualizerData,
		lastRenderContext.options,
	);
	return true;
}

function startCurrentHourTicker(table) {
	if (!table) return;
	stopCurrentHourTicker();

	updateCurrentHourHighlight(table);
	scheduleNextTick();

	function scheduleNextTick() {
		const now = new Date();
		const msUntilNextMinute =
			(60 - now.getSeconds()) * 1000 - now.getMilliseconds();
		currentHourTimerId = window.setTimeout(
			() => {
				const rerendered = updateCurrentHourHighlight(table);
				if (!rerendered) {
					scheduleNextTick();
				}
			},
			Math.max(msUntilNextMinute, 1000),
		);
	}
}

function stopCurrentHourTicker() {
	if (currentHourTimerId) {
		clearTimeout(currentHourTimerId);
		currentHourTimerId = null;
	}
}

function updateCurrentHourHighlight(table) {
	if (!table) return false;
	if (rerenderIfDateChanged()) return true;

	if (currentHourCell) {
		currentHourCell.classList.remove("is-current-hour");
		currentHourCell.style.removeProperty("--viz-now-start");
		currentHourCell.style.removeProperty("--viz-now-end");
		currentHourCell = null;
	}

	const now = new Date();
	const dateStr = now.toLocaleDateString("sv-SE");
	const hourStr = `${String(now.getHours()).padStart(2, "0")}:00`;
	const minutes = now.getMinutes();
	const segmentIndex = Math.floor(minutes / 4); // 0-14 (15 segments)
	const segmentHeight = 100 / 15;
	const startPercent = segmentIndex * segmentHeight;
	const endPercent = (segmentIndex + 1) * segmentHeight;

	const selector = `td[data-date="${dateStr}"][data-time="${hourStr}"]`;
	const cell = table.querySelector(selector);
	if (!cell) return false;

	currentHourCell = cell;

	cell.classList.add("is-current-hour");
	cell.style.setProperty("--viz-now-start", `${startPercent}%`);
	cell.style.setProperty("--viz-now-end", `${endPercent}%`);
	return false;
}

// =====================
// Warning marker handler
// =====================

function setupWarningMarkerHandler(table) {
	if (!table || table.dataset.warningHandlerAttached === "true") return;

	table.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		const marker = target.closest(".warning-marker");
		if (!marker) return;

		const scope = marker.dataset.commandScope === "today" ? "today" : "week";
		const command = `[SILENT]${RUNNER_BASE_COMMAND} ${scope}`;

		triggerShortcut(command);
	});

	table.dataset.warningHandlerAttached = "true";
}

// Status mark (absent/comment) -> jump to makeup or blink
function setupStatusMarkHandler(table) {
	if (!table || table.dataset.statusMarkHandlerAttached === "true") return;

	table.addEventListener(
		"click",
		(event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;

			const btn = target.closest(".status-mark-btn");
			if (!btn) return;

			const date = btn.dataset.targetDate;
			const time = btn.dataset.targetTime;
			const cell = btn.closest("td");

			event.preventDefault();
			event.stopPropagation();

			if (date && time) {
				const ok = window.VIZ?.scrollToSlot?.({
					date,
					time,
					highlight: true,
					anchorX: 0.2,
					anchor: 0.2,
				});
				if (!ok) {
					scrollToSlot({ date, time, highlight: true, fallbackEl: cell });
				}
			} else if (cell) {
				cell.classList.remove("flash-no-target");
				// force reflow to restart animation
				void cell.offsetWidth;
				cell.classList.add("flash-no-target");
			}
		},
		true,
	);

	table.dataset.statusMarkHandlerAttached = "true";
}

function buildMakeupTargetMap(items) {
	const map = new Map();
	items.forEach((item) => {
		const origin = item.makeupOrigin;
		if (!origin || !origin.date || !origin.time) return;
		const originKey = origin.scheduleKey || `${origin.date}T${origin.time}`;
		const target = {
			date: item.date,
			time: item.time,
			scheduleKey: `${item.date}T${item.time}`,
			label: item.label,
		};
		if (!map.has(originKey)) map.set(originKey, []);
		map.get(originKey).push(target);
	});
	return map;
}

// =====================
// Materials ribbon hover (course-wide preview)
// =====================

let materialsPopover = null;
let materialsHideTimer = null;
let courseMaterialsMapRef = null;

function buildCourseMaterialsMap(items) {
	const map = new Map();
	items.forEach((item) => {
		if (!item?.materials?.length) return;
		const key = item.label;
		if (!map.has(key)) map.set(key, []);
		map.get(key).push({
			date: item.date,
			time: item.time,
			scheduleKey: `${item.date}T${item.time}`,
			materials: item.materials,
			pageUrl: item.pageUrl,
			lmsUrl: item.lmsUrl,
			countRaw: item.count?.raw || "",
		});
	});
	map.forEach((list) => {
		list.sort((a, b) =>
			a.date === b.date
				? a.time.localeCompare(b.time)
				: a.date.localeCompare(b.date),
		);
	});
	return map;
}

function setupMaterialsRibbonHover(courseMaterialsMap) {
	courseMaterialsMapRef = courseMaterialsMap;
	if (document.__materialsRibbonHoverAttached) return;

	const onEnter = (event) => {
		const ribbon = event.target.closest?.(".material-ribbon");
		const popover = event.target.closest?.(".viz-materials-popover");
		if (popover) {
			clearHideTimer();
			return;
		}
		if (!ribbon) return;
		clearHideTimer();
		const block = ribbon.closest(".item-block");
		if (!block) return;
		const courseKey = block.dataset.courseKey;
		const scheduleKey = block.dataset.scheduleKey;
		if (!courseKey) return;
		const entries = courseMaterialsMapRef?.get(courseKey);
		if (!entries?.length) return;
		showMaterialsPopover({
			referenceEl: block,
			courseKey,
			scheduleKey,
			entries,
		});
	};

	const onLeave = (event) => {
		const fromRibbon = event.target.closest?.(".material-ribbon");
		const fromPopover = event.target.closest?.(".viz-materials-popover");
		if (!fromRibbon && !fromPopover) return;
		const related = event.relatedTarget;
		if (related && (related.closest?.(".material-ribbon") || related.closest?.(".viz-materials-popover"))) {
			return; // still inside interactive area
		}
		startHideTimer();
	};

	document.addEventListener("pointerenter", onEnter, true);
	document.addEventListener("pointerleave", onLeave, true);
	document.__materialsRibbonHoverAttached = true;
}

function ensureMaterialsPopover() {
	if (materialsPopover) return materialsPopover;
	const el = document.createElement("div");
	el.id = "viz-materials-popover";
	el.className = "viz-materials-popover";
	el.setAttribute("role", "dialog");
	el.style.position = "absolute";
	el.style.display = "none";
	el.style.zIndex = "999";
	document.body.appendChild(el);
	materialsPopover = el;
	return el;
}

function showMaterialsPopover({ referenceEl, courseKey, scheduleKey, entries }) {
	const pop = ensureMaterialsPopover();
	pop.innerHTML = renderMaterialsPopoverContent({ courseKey, scheduleKey, entries });
	pop.style.display = "block";

	const refRect = referenceEl.getBoundingClientRect();
	const popRect = pop.getBoundingClientRect();
	const top = window.scrollY + refRect.top;
	let left = Math.max(
		window.scrollX + 8,
		window.scrollX + refRect.left - popRect.width - 12,
	);

	pop.style.top = `${top}px`;
	pop.style.left = `${left}px`;
}

function hideMaterialsPopover() {
	if (!materialsPopover) return;
	materialsPopover.style.display = "none";
}

function startHideTimer() {
	clearHideTimer();
	materialsHideTimer = window.setTimeout(() => hideMaterialsPopover(), 180);
}

function clearHideTimer() {
	if (materialsHideTimer) {
		clearTimeout(materialsHideTimer);
		materialsHideTimer = null;
	}
}

function renderMaterialsPopoverContent({ courseKey, scheduleKey, entries }) {
	const dedupedEntries = dedupeMaterialsAcrossEntries(entries);
	const itemsHtml = dedupedEntries
		.map((e) => {
			const materialsHtml = e.materials
				.map((m) => renderMaterialLine(m))
				.join("");
			const metaText = e.countRaw
				? `${e.date} ${e.time}（${e.countRaw}）`
				: `${e.date} ${e.time}`;
			return `
		    <div class="viz-materials-slot ${e.scheduleKey === scheduleKey ? "is-current" : ""}">
		      <div class="viz-materials-meta">${metaText}</div>
		      <div class="materials">${materialsHtml}</div>
		    </div>
		  `;
		})
		.join("");

	return `
	  <div class="viz-materials-header">${courseKey} の資料</div>
	  <div class="viz-materials-list">${itemsHtml}</div>
	`;
}

// remove duplicates across the whole popover (same url+text), keeping first occurrence
function dedupeMaterialsAcrossEntries(entries = []) {
	const seen = new Set();
	const result = [];
	entries.forEach((e) => {
		const filtered = (e.materials || []).filter((m) => {
			const key = `${m.url || ""}|${m.text || ""}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		if (filtered.length) {
			result.push({ ...e, materials: filtered });
		}
	});
	return result;
}

function renderMaterialLine(material) {
	const notionUrl =
		material?.notionUrl || findNotionUrlForMaterial(material?.text);
	const p5Url = findP5UrlForMaterial(material?.text);
	const notionBtn = notionUrl
		? `<button type="button" class="material-notion-btn" data-notion-url="${notionUrl}" data-material-url="${material?.url || ""}" aria-label="Notionで開く" title="Notionで開く（右クリックでNotion＋資料）"><img src="https://cdn.simpleicons.org/notion/ffffff" alt="Notion" class="material-notion-icon" loading="lazy" /></button>`
		: "";
	const p5Btn = p5Url
		? `<button type="button" class="material-p5-btn" data-p5-url="${p5Url}" data-material-url="${material?.url || ""}" aria-label="P5で開く" title="P5で開く"><img src="https://cdn.simpleicons.org/html5/E34F26" alt="HTML" class="material-p5-icon" loading="lazy" /></button>`
		: "";

	return `
	  <div class="material-link-wrap">
	    <a href="${material.url}" target="_blank" class="material-link">${material.text}</a>
	    ${notionBtn}
	    ${p5Btn}
	  </div>
	`;
}

function setupOrphanBadgeHandler(table) {
	const targetNode = document;
	if (!targetNode || targetNode.__orphanHandlerAttached) return;

	const handler = (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		// デバッグ用：捕捉できているか確認
		// console.debug("[orphanBadge] global click", target);

		const badge = target.closest(".orphan-badge");
		if (!badge) return;

		const date = badge.dataset.makeupDate;
		const time = badge.dataset.makeupTime;
		const fallbackEl = badge.closest("td");
		if (!date || !time) return;

		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		event.preventDefault();
		event.stopPropagation();

		console.log("[orphanBadge] click", {
			date,
			time,
			hasFallback: Boolean(fallbackEl),
		});

		const ok = window.VIZ?.scrollToSlot?.({
			date,
			time,
			highlight: true,
			fallbackEl,
		});
		if (!ok) {
			console.warn("[orphanBadge] scrollToSlot failed", { date, time });
			scrollToSlot({ date, time, highlight: true, fallbackEl });
		}
	};

	targetNode.addEventListener("click", handler, { capture: true });
	targetNode.__orphanHandlerAttached = true;
}

function triggerShortcut(command) {
	const shortcutName =
		window.SCHEDULE_VIZ_SHORTCUT_NAME || DEFAULT_SHORTCUT_NAME;
	const shortcutUrl = `shortcuts://run-shortcut?name=${encodeURIComponent(
		shortcutName,
	)}&input=text&text=${encodeURIComponent(command)}`;

	const opened = window.open(shortcutUrl, "_blank");
	if (!opened) {
		console.info(
			`[visualizer_common] ショートカットを起動できませんでした。Shortcutsに "${shortcutName}" を作成し、入力テキストを端末に貼り付ける処理を組み込んでください。`,
		);
	}
}
