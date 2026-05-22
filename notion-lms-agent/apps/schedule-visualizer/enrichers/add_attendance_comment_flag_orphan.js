// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/enrichers/add_attendance_comment_flag_orphan.js
import fs from "fs";
import path from "path";
import { buildAttendanceStatusMap } from "../../../modules/common/visualizer/lib/buildAttendanceStatusMap.js";

/**
 * ORPHAN VISUALIZER_DATA 用
 * Array -> Array
 */
export function addAttendanceCommentFlagOrphan(items, baseDir) {
  if (!Array.isArray(items)) return items;

  const lessonsPath = path.join(
    baseDir,
    "..",
    "..",
    "data",
    "lms_lessons_orphan.json"
  );

  if (!fs.existsSync(lessonsPath)) {
    return items;
  }

  const lessons = JSON.parse(fs.readFileSync(lessonsPath, "utf8"));

  // ★ ここが唯一の判定ロジック呼び出し
  const statusMap = buildAttendanceStatusMap(lessons);

  return items.map((i) => {
    const key = `${i.date}T${i.time}`;
    const status = statusMap.get(key);

    return {
      ...i,
      hasAttendanceComment: status?.hasAttendWithComment === true,
    };
  });
}
