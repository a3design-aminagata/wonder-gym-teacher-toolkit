// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/data/buildItems.js
/**
 * 共通：VISUALIZER_DATA から items を作る
 * - materials / lmsUrl / area を保持
 */
import { normalizeTime, parseTimeToNumber } from "./dateUtils.js";

export function buildItemsFromVisualizerData(VISUALIZER_DATA) {
	const items = [];

	const pushItem = (i, fallbackType) => {
		const area = i.area || "";
		const month = i.month;
		const category = i.category || "";
		const monthPart = month ? `${month}月` : "";
		const categoryPart = category || "";
		const label = `${area}${monthPart}${categoryPart}`;

		items.push({
			date: i.date,
			time: normalizeTime(i.time),
			label,
			type: i.type || fallbackType,
			count: i.count || null,
			isOrphan: i.isOrphan === true,
			materials: i.materials || [],
			lmsUrl: i.lmsUrl || null,
			pageUrl: i.pageUrl || null,
			category,
			makeupOrigin: i.makeupOrigin || null,

			// ★LMS由来
			teacherStatus: i.teacherStatus || null, // "matched" | "missing" | "different" | ...
			editUrls: i.editUrls || [], // ["https://.../online_lessons/.../edit", ...]
			teacherNames: i.teacherNames || [], // ★追加（違う講師名を出す用）
			slotStudents: i.slotStudents || [], // [{ name, furigana }]
			slotStudentHistories: i.slotStudentHistories || [], // [{ name, furigana, comments:[...] }]

			hasAttendanceComment: i.hasAttendanceComment === true,
			hasAbsent: i.hasAbsent === true,
			isManualPending: i.isManualPending === true,

			// 初回 / 最終 回数マイルストーン
			isFirstMeeting: i.isFirstMeeting === true,
			isLastMeeting: i.isLastMeeting === true,
			firstStudents: i.firstStudents || [],
			lastStudents: i.lastStudents || [],
			studentName: i.studentName || null,
			course: i.course || "",

			area,
			month,
			raw: i.raw || "",
		});
	};

	(VISUALIZER_DATA.available || []).forEach((i) => pushItem(i, "available"));
	(VISUALIZER_DATA.mine || []).forEach((i) => pushItem(i, "mine"));
	(VISUALIZER_DATA.past || []).forEach((i) => pushItem(i, "past"));

	const ORPHAN_DATA = window.ORPHAN_VISUALIZER_DATA || [];
	ORPHAN_DATA.forEach((i) =>
		pushItem(
			{
				...i,
				type: "mine",
				isOrphan: true,
			},
			"mine",
		),
	);

	// 重複排除：同じ日付・時間・ラベルのコマは1つだけ残す
	const seen = new Set();
	const deduped = [];
	items.forEach((item) => {
		const key = `${item.date}|${item.time}|${item.label}`;
		if (seen.has(key)) return;
		seen.add(key);
		// 同一コマ内での資料リンクも URL で重複排除
		const materialSeen = new Set();
		item.materials = (item.materials || []).filter((m) => {
			const mKey = `${m.url}|${m.text}`;
			if (materialSeen.has(mKey)) return false;
			materialSeen.add(mKey);
			return true;
		});
		deduped.push(item);
	});

	deduped.sort((a, b) => {
		if (a.date === b.date)
			return parseTimeToNumber(a.time) - parseTimeToNumber(b.time);
		return a.date < b.date ? -1 : 1;
	});

	return deduped;
}
