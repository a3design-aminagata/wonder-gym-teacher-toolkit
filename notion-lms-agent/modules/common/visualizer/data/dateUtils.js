// modules/common/visualizer/data/dateUtils.js

export function normalizeTime(t) {
	let [h, m] = String(t).split(":").map(Number);
	if (Number.isNaN(h)) h = 0;
	if (Number.isNaN(m)) m = 0;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTimeToNumber(timeStr) {
	return Number(String(timeStr).split(":")[0]);
}

export function getWeekdayJP(dateStr) {
	const d = new Date(dateStr);
	return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

export function buildDateRangeFromItems(items) {
	const dates = [...new Set(items.map((i) => i.date))];
	if (dates.length === 0) return [];

	const sorted = dates.slice().sort();
	const start = new Date(sorted[0]);
	const end = new Date(sorted[sorted.length - 1]);

	const result = [];
	const d = new Date(start);

	while (d <= end) {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		result.push(`${yyyy}-${mm}-${dd}`);
		d.setDate(d.getDate() + 1);
	}

	return result;
}

export function makeTimeScale(items) {
	const allTimes = items.map((i) => Number(String(i.time).split(":")[0]));
	const minT = Math.min(...allTimes);
	const maxT = Math.max(...allTimes);

	const scale = [];
	for (let h = minT; h <= maxT; h++) {
		scale.push(`${String(h).padStart(2, "0")}:00`);
	}
	return scale;
}

export function groupDatesByMonth(dateList) {
	if (!dateList.length) return [];

	const groups = [];
	let currentMonth = null;
	let currentCount = 0;

	dateList.forEach((d) => {
		const m = d.slice(0, 7);
		if (m !== currentMonth) {
			if (currentMonth !== null)
				groups.push({ month: currentMonth, span: currentCount });
			currentMonth = m;
			currentCount = 1;
		} else {
			currentCount++;
		}
	});

	if (currentMonth !== null)
		groups.push({ month: currentMonth, span: currentCount });
	return groups;
}
