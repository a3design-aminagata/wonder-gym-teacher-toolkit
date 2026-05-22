// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/logic/computeCellState.js
export function computeCellState({ date, time, cellItems, today, now }) {
	const hasAbsent = cellItems.some((c) => c.hasAbsent === true);
	const hasAttendanceComment = cellItems.some(
		(c) => c.hasAttendanceComment === true,
	);

	const cellDateTime = new Date(`${date}T${time}:00`);
	const isPast = cellDateTime <= now;

	const hasWarning =
		isPast && cellItems.some((c) => c.hasAttendanceComment !== true);

	const isConflictCell = cellItems.some((c) => c.type === "conflict");

	let statusClass = "";
	if (hasAbsent) statusClass = "has-absent";
	else if (hasWarning) statusClass = "has-warning";
	else if (hasAttendanceComment) statusClass = "has-attendance-comment";

	return {
		isConflictCell,
		statusClass,
	};
}
