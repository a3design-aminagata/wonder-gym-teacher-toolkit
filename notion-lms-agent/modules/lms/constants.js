import { loadParentEnv } from "../common/loadEnv.js";

loadParentEnv(import.meta.url);

function normalizeBaseUrl(value) {
	return String(value || "")
		trim()
		.replace(/\/+$/, "");
}

function requireEnv(name) {
	const value = normalizeBaseUrl(process.env[name]);
	if (!value) {
		throw new Error(`${name} is required. Set it in .env`);
	}
	return value;
}

export const LMS_BASE_URL = requireEnv("LMS_BASE_URL");
export const LMS_LOGIN_URL = `${LMS_BASE_URL}/login`;
export const LMS_ATTENDANCE_BASE_URL = `${LMS_BASE_URL}/lecturer-portal/online-lesson-attendances`;
export const LMS_USER_GROUPS_URL = `${LMS_ATTENDANCE_BASE_URL}/user_groups`;
export const LMS_LESSON_EDIT_BASE_URL = `${LMS_ATTENDANCE_BASE_URL}/online_lessons`;
export const LMS_DECIDED_SCHEDULES_URL = `${LMS_BASE_URL}/lecturer-portal/lecturer-schedule-input/decided-schedules`;
