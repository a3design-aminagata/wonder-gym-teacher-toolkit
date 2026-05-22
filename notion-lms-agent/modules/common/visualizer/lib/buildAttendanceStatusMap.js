// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/lib/buildAttendanceStatusMap.js
export function buildAttendanceStatusMap(lessons) {
  const map = new Map();

  for (const l of lessons) {
    const matched = Array.isArray(l.matchedLessons) ? l.matchedLessons : [];
    const hasAttendWithComment = matched.some((m) => {
      const attendanceOk =
        typeof m.attendance === "string" && m.attendance.includes("参加");

      const comment =
        m.comment ?? m.attendanceComment ?? m.memo ?? m.note ?? "";

      return (
        attendanceOk && typeof comment === "string" && comment.trim() !== ""
      );
    });

    const hasAbsent = matched.some(
      (m) => typeof m.attendance === "string" && m.attendance.includes("不参加")
    );

    map.set(l.scheduleKey, {
      hasAttendWithComment,
      hasAbsent,
    });
  }

  return map;
}
