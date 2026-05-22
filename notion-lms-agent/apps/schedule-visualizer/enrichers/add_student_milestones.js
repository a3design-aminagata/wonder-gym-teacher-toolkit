// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/enrichers/add_student_milestones.js
/**
 * 目的:
 * - lms_lessons_for_schedules.json から「生徒ごとの初回 / 最終回」を推定し、
 *   scheduleKey 単位でフラグと対象生徒名リストを付与する。
 *
 * 初回判定:
 * - countLabel が「1回目」を含む場合は初回扱い。
 * - それが無い場合は、その生徒が最初に登場する scheduleKey を初回扱い。
 *
 * 最終判定:
 * - schedules_enriched.json の count.total が存在し、かつ countLabel の回数が total に等しい場合のみ最終扱い。
 * - total が取れない場合は安全側で最終フラグを付けない。
 */

import fs from "fs";
import path from "path";
import { scheduleKeyOf, normalizeTime } from "../../../modules/common/visualizer/lib/scheduleKey.js";

function parseCount(label) {
	if (!label) return null;
	const m = String(label).match(/(\d+)回目/);
	return m ? Number(m[1]) : null;
}

export function addStudentMilestones(visualizerData, baseDir) {
	const dataDir = path.join(baseDir, "..", "..", "data");
	const lessonsPath = path.join(dataDir, "lms_lessons_for_schedules.json");
	const schedulesEnrichedPath = path.join(dataDir, "schedules_enriched.json");

	if (!fs.existsSync(lessonsPath)) return visualizerData;

	const lessons = JSON.parse(fs.readFileSync(lessonsPath, "utf8"));

	// scheduleKey -> total (全回数)
	const totalMap = new Map();
	if (fs.existsSync(schedulesEnrichedPath)) {
		const enriched = JSON.parse(fs.readFileSync(schedulesEnrichedPath, "utf8"));
		for (const row of enriched) {
			if (!row?.date || !row?.time) continue;
			const key = row.scheduleKey || scheduleKeyOf(row.date, normalizeTime(row.time));
			const total = row?.count?.total;
			if (key && Number.isFinite(total)) {
				totalMap.set(key, Number(total));
			}
		}
	}

	// 生徒ごとの出現リスト + スロットに紐づく生徒集合を構築
	const studentEvents = new Map(); // name -> [{scheduleKey, date, time, countNum, total}]
	const presentStudentMap = new Map(); // scheduleKey -> Set(studentName)

	for (const row of lessons) {
		const slotTime = normalizeTime(row.time);
		const baseKey =
			row.scheduleKey ||
			(row.date && slotTime ? scheduleKeyOf(row.date, slotTime) : null);

		for (const l of row.matchedLessons || []) {
			const studentName = (l.studentName || "").trim();
			if (!studentName) continue;

			const date = row.date;
			const time = normalizeTime(l.start || row.time);

			// 同じ日時のコマだけに限定（別時間のレッスンを混入させない）
			if (!slotTime || time !== slotTime) continue;

			const scheduleKey = baseKey || (date && time ? scheduleKeyOf(date, time) : null);
			if (!scheduleKey) continue;

			const countNum = parseCount(l.countLabel);
			const total = totalMap.get(scheduleKey) ?? null;

			if (!studentEvents.has(studentName)) studentEvents.set(studentName, []);
			studentEvents.get(studentName).push({
				scheduleKey,
				date,
				time,
				countNum,
				total,
			});

			if (!presentStudentMap.has(scheduleKey)) presentStudentMap.set(scheduleKey, new Set());
			presentStudentMap.get(scheduleKey).add(studentName);
		}
	}

	const firstMap = new Map(); // scheduleKey -> Set(name)
	const lastMap = new Map(); // scheduleKey -> Set(name)

	for (const [name, events] of studentEvents.entries()) {
		events.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

		// 初回判定
		const firstByLabel = events.find((e) => e.countNum === 1);
		const firstEvent = firstByLabel || events[0];
		if (firstEvent?.scheduleKey) {
			if (!firstMap.has(firstEvent.scheduleKey)) firstMap.set(firstEvent.scheduleKey, new Set());
			firstMap.get(firstEvent.scheduleKey).add(name);
		}

		// 最終判定:
		// 1) total が取れる場合は total と一致する回だけ
		// 2) total が取れない場合は、その生徒の最大 countNum の「最後の回」（時系列末尾）だけ
		const eventsWithCount = events.filter((e) => Number.isFinite(e.countNum));

		let lastCandidate = null;
		let expectedTotal = null;

		// total が取れる場合は最大値を採用（途中の回数で total=10, 最終で total=11 などの揺れに対応）
		const totalValues = eventsWithCount
			.map((e) => (Number.isFinite(e.total) ? e.total : null))
			.filter((v) => v !== null);
		if (totalValues.length) {
			expectedTotal = Math.max(...totalValues);
		}

		if (expectedTotal) {
			const matches = eventsWithCount.filter(
				(e) => e.countNum === expectedTotal,
			);
			if (matches.length) {
				lastCandidate = matches[matches.length - 1]; // 同じ回数なら一番遅い日時
			}
		}

		// total が無い場合は最大 countNum の最後の出現を最終扱い
		if (!lastCandidate && eventsWithCount.length) {
			const maxCount = Math.max(...eventsWithCount.map((e) => e.countNum));
			const matches = eventsWithCount.filter((e) => e.countNum === maxCount);
			lastCandidate = matches[matches.length - 1];
		}

		if (lastCandidate?.scheduleKey) {
			if (!lastMap.has(lastCandidate.scheduleKey)) lastMap.set(lastCandidate.scheduleKey, new Set());
			lastMap.get(lastCandidate.scheduleKey).add(name);
		}
	}

	const enrichList = (list) =>
		(list || []).map((v) => {
			const firstSet = firstMap.get(v.scheduleKey) || new Set();
			const lastSet = lastMap.get(v.scheduleKey) || new Set();
			const presentSet = presentStudentMap.get(v.scheduleKey) || new Set();

			const firstFiltered = Array.from(firstSet).filter((n) =>
				presentSet.has(n),
			);
			const lastFiltered = Array.from(lastSet).filter((n) =>
				presentSet.has(n),
			);

			return {
				...v,
				isFirstMeeting: firstFiltered.length > 0,
				isLastMeeting: lastFiltered.length > 0,
				firstStudents: firstFiltered,
				lastStudents: lastFiltered,
			};
		});

	return {
		...visualizerData,
		mine: enrichList(visualizerData.mine),
		past: enrichList(visualizerData.past),
		available: enrichList(visualizerData.available),
	};
}
