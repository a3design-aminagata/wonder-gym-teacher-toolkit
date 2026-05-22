// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/view/renderCellView.js
import { getColorClassForKey } from "../utils/color.js";
import { findNotionUrlForMaterial } from "../data/material_notion_map.js";
import { findP5UrlForMaterial } from "../data/material_p5_map.js";

const NOTION_ICON_URL = "https://cdn.simpleicons.org/notion/ffffff";
// 白背景でも見えるようにブランドカラー版を使用
const P5_ICON_URL = "https://cdn.simpleicons.org/html5/E34F26";

function renderMaterialNotionBtn(material) {
	const notionUrl = findNotionUrlForMaterial(material?.text);
	if (!notionUrl) return "";

	// デフォルトブラウザで開く想定。右クリック時は Notion + 元リンクの両方を開く。
	return `
      <button
        type="button"
        class="material-notion-btn"
        data-notion-url="${notionUrl}"
        data-material-url="${material?.url || ""}"
        aria-label="Notionで開く"
        title="Notionで開く（右クリックでNotion＋資料）"
      >
        <img src="${NOTION_ICON_URL}" alt="Notion" class="material-notion-icon" loading="lazy" />
      </button>
    `;
}

function renderMaterialP5Btn(material) {
	const p5Url = findP5UrlForMaterial(material?.text);
	if (!p5Url) return "";

	return `
      <button
        type="button"
        class="material-p5-btn"
        data-p5-url="${p5Url}"
        data-material-url="${material?.url || ""}"
        aria-label="P5で開く"
        title="P5で開く"
      >
        <img src="${P5_ICON_URL}" alt="HTML" class="material-p5-icon" loading="lazy" />
      </button>
	`;
}

function isManualPendingHiddenMaterial(material) {
	const text = String(material?.text || "").trim();
	return text === "振替授業URL";
}

function escapeAttr(text) {
	return String(text ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;");
}

export function renderCellView({
	cellItems,
	state,
	orphanSheetUrl,
	today,
	isToday,
	isCurrentHour,
	date,
	time,
	makeupTargets = [],
}) {
	let html = "";

	const hasOrphan = cellItems.some((c) => c.isOrphan);
	const hasMakeupOrigin = cellItems.some((c) => Boolean(c.makeupOrigin?.date));
	const warningScope =
		isToday && !hasOrphan && !hasMakeupOrigin ? "today" : "week";
	const warningMarker =
		state.statusClass === "has-warning"
			? `<button type="button" class="warning-marker" data-command-scope="${warningScope}" aria-label="run command for ${warningScope}">⚠️</button>`
			: "";

	const hasStatusMark =
		state.statusClass &&
		state.statusClass.startsWith("has-") &&
		state.statusClass !== "has-warning";

	const firstTarget = makeupTargets?.[0];
	const statusMarkBtn =
		hasStatusMark &&
		`<button type="button"
          class="status-mark-btn"
          data-target-date="${firstTarget?.date || ""}"
          data-target-time="${firstTarget?.time || ""}"
          data-tooltip="${
						firstTarget
							? `振替 ${firstTarget.date} ${firstTarget.time} へ移動`
							: "振替先なし"
					}"
          aria-label="${
						firstTarget
							? `振替 ${firstTarget.date} ${firstTarget.time} へ移動`
							: "振替先なし"
					}"
        ></button>`;

	cellItems.forEach((c) => {
		const cellDate = new Date(c.date);
		cellDate.setHours(0, 0, 0, 0);
		const beforeClass = cellDate < today ? "before-today" : "";

		const colorKey = `${c.area || ""}${c.month ? `${c.month}月` : ""}`;
		const colorClass = getColorClassForKey(colorKey);

		let materialsHtml = "";
		let materialsRibbon = "";
		const materials = Array.isArray(c.materials) ? c.materials : [];
		const hiddenManualPendingMaterial = c.isManualPending
			? materials.find((m) => isManualPendingHiddenMaterial(m))
			: null;
		const manualPendingMaterialUrl = hiddenManualPendingMaterial?.url || "";
		const manualPendingMaterialUrlAttr = manualPendingMaterialUrl.replaceAll(
			'"',
			"&quot;",
		);
		const visibleMaterials =
			c.isManualPending && hiddenManualPendingMaterial
				? materials.filter((m) => m !== hiddenManualPendingMaterial)
				: materials;

		if (visibleMaterials.length) {
			const materialsLinksHtml = visibleMaterials
				.map(
					(m) => `
              <div class="material-link-wrap">
                <a href="${m.url}" target="_blank" class="material-link">${m.text}</a>
                ${renderMaterialNotionBtn(m)}
                ${renderMaterialP5Btn(m)}
              </div>
            `,
				)
				.join("");

			materialsHtml = `<div class="materials">${materialsLinksHtml}</div>`;
			materialsRibbon = `<button type="button" class="material-ribbon" aria-label="資料あり" title="資料あり"></button>`;
		}

		const firstEditUrl = c.editUrls && c.editUrls.length ? c.editUrls[0] : null;
		const statusUrl = firstEditUrl;

		const milestoneBadges = [];
		if (c.isFirstMeeting) {
			const names = (c.firstStudents || []).join(", ");
			const firstStudentsJson = escapeAttr(
				JSON.stringify(c.firstStudents || []),
			);
			const slotStudentsJson = escapeAttr(
				JSON.stringify(c.slotStudents || []),
			);
			const areaAttr = escapeAttr(c.area || "");
			const dateAttr = escapeAttr(c.date || "");
			const timeAttr = escapeAttr(c.time || "");
			const statusUrlAttr = escapeAttr(statusUrl || "");
			milestoneBadges.push(
				`<span class="badge-milestone badge-first" title="初回: ${names || "初回"}" data-tooltip="初回: ${names || "初回"}" data-first-students="${firstStudentsJson}" data-slot-students="${slotStudentsJson}" data-area="${areaAttr}" data-date="${dateAttr}" data-time="${timeAttr}" data-status-url="${statusUrlAttr}">🔰</span>`,
			);
		}
		if (c.isLastMeeting) {
			const names = (c.lastStudents || []).join(", ");
			const lastStudentsJson = escapeAttr(
				JSON.stringify(c.lastStudents || []),
			);
			const courseAttr = escapeAttr(c.course || "");
			const areaAttr = escapeAttr(c.area || "");
			const dateAttr = escapeAttr(c.date || "");
			const timeAttr = escapeAttr(c.time || "");
			const statusUrlAttr = escapeAttr(statusUrl || "");
			milestoneBadges.push(
				`<span class="badge-milestone badge-last" title="最終: ${names || "最終"}" data-tooltip="最終: ${names || "最終"}" data-last-students="${lastStudentsJson}" data-course="${courseAttr}" data-area="${areaAttr}" data-date="${dateAttr}" data-time="${timeAttr}" data-status-url="${statusUrlAttr}">🎓</span>`,
			);
		}

		const titleLinkUrl =
			c.lmsUrl || (c.isManualPending && firstEditUrl ? firstEditUrl : null);
		const notionLink = c.pageUrl
			? `<a href="${c.pageUrl}" target="_blank" class="notion-link" aria-label="Notionページを開く"><img src="${NOTION_ICON_URL}" alt="Notion" class="notion-icon" loading="lazy" /></a>`
			: "";
		const manualPendingBadge =
			c.isManualPending && !firstEditUrl
				? `<span class="badge-manual-pending" title="LMS未登録の暫定振替">仮</span>`
				: "";
		const titleLabel = titleLinkUrl
			? `<a href="${titleLinkUrl}" target="_blank" class="item-title-link">${c.label}</a>`
			: c.label;

		const statusText = statusUrl
			? firstEditUrl &&
			  (c.teacherStatus === "missing" || c.teacherStatus === "no_row")
				? "未登録"
				: "▶"
			: "";

		const statusLink =
			statusText && statusUrl
				? ` <a href="${statusUrl}" target="_blank" class="status-link">${statusText}</a>`
				: "";

		const otherTeacherText =
			c.teacherStatus === "different" && c.teacherNames && c.teacherNames.length
				? ` <span class="teacher-different">(${c.teacherNames.join(", ")})</span>`
				: "";

		const titleInner = `${notionLink}${titleLabel}${manualPendingBadge}${milestoneBadges.join("")}${statusLink}${otherTeacherText}`;

		const orphanBadge = c.isOrphan
			? `
        <button
          type="button"
          class="orphan-badge"
          data-makeup-date="${c.makeupOrigin?.date ?? ""}"
          data-makeup-time="${c.makeupOrigin?.time ?? ""}"
          data-makeup-schedule-key="${c.makeupOrigin?.scheduleKey ?? ""}"
          data-tooltip="${c.makeupOrigin?.date ? `振替元: ${c.makeupOrigin.date}${c.makeupOrigin.time ? ` ${c.makeupOrigin.time}` : ""}` : "振替元: 不明"}"
          aria-label="${c.makeupOrigin?.date ? `振替元 ${c.makeupOrigin.date}${c.makeupOrigin.time ? ` ${c.makeupOrigin.time}` : ""} へ移動` : "振替元へ移動"}"
        >
          <span class="orphan-icon" aria-hidden="true">➡️</span>
        </button>
      `
			: "";

		html += `
		      <div class="${c.type} item-block ${beforeClass} ${colorClass}" data-course-key="${c.label}" data-schedule-key="${c.date}T${c.time}" data-manual-pending-url="${manualPendingMaterialUrlAttr}">
		        ${materialsRibbon}
		        <div class="item-title">
	          ${titleInner}
          ${orphanBadge}
        </div>
        ${materialsHtml}
      </div>
    `;
	});

	const cls = [
		"cell",
		state.isConflictCell ? "conflict-cell" : "",
		state.statusClass,
		isCurrentHour ? "is-current-hour" : "",
		hasStatusMark ? "has-mark-btn" : "",
	]
		.filter(Boolean)
		.join(" ");

	return `<td data-date="${date}" data-time="${time}" class="${cls} ${isToday ? "is-today" : ""}">${warningMarker}${statusMarkBtn || ""}${html}</td>`;
}
