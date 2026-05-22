// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/lib/buildMonthlyIndex.js
export function buildMonthlyIndex(schedules, options = {}) {
	const { excludeArea } = options;

	const filtered = schedules.filter((item) => {
		if (excludeArea && item.area === excludeArea) return false;
		return true;
	});

	return filtered.reduce((acc, item) => {
		const d = new Date(item.date);
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const key = `${d.getFullYear()}-${month}`;
		if (!acc[key]) acc[key] = [];
		acc[key].push(item);
		return acc;
	}, {});
}
