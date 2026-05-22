// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/lib/buildLessonMap.js
import { LMS_BASE_URL } from "../../../lms/constants.js";

const LMS_ORIGIN = LMS_BASE_URL;

function toAbsUrl(u) {
	if (!u) return null;
	if (u.startsWith("http")) return u;
	if (u.startsWith("/")) return LMS_ORIGIN + u;
	return LMS_ORIGIN + "/" + u;
}

function normalizeMatchedLessons(matchedLessons = []) {
	const editUrls = new Set();
	const teacherNames = new Set();
	let hasAttendanceComment = false;

	for (const l of matchedLessons) {
		if (l.editUrl) editUrls.add(toAbsUrl(l.editUrl));
		if (l.teacherName) teacherNames.add(String(l.teacherName).trim());

		if (
			l.attendance ||
			l.motivation ||
			l.progress ||
			(l.comment && l.comment.trim())
		) {
			hasAttendanceComment = true;
		}
	}

	return {
		editUrls: Array.from(editUrls),
		teacherNames: Array.from(teacherNames),
		hasAttendanceComment,
	};
}

export function buildLessonMap(rows = []) {
	const lessonMap = new Map();

	for (const row of rows) {
		if (!row.scheduleKey) continue;

		lessonMap.set(row.scheduleKey, {
			teacherStatus: row.teacherStatus ?? null,
			matchedLessons: row.matchedLessons ?? [],
		});
	}

	return lessonMap;
}
