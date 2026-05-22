// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/lms/lessons/parts/patchByScheduleKey.js
/**
 * scheduleKey 単位で差し替える patch
 * - out に含まれる scheduleKey は既存から削除
 * - それ以外は保持
 *
 * @param {Array} existingAll 既存の JSON 配列（破壊的に変更される）
 * @param {Array} out 今回生成した配列
 */
export function patchByScheduleKey(existingAll, out) {
	const replaceKeys = new Set(out.map((o) => o.scheduleKey));

	const kept = existingAll.filter((o) => !replaceKeys.has(o.scheduleKey));

	existingAll.length = 0;
	existingAll.push(...kept, ...out);
}
