// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/enrichers/add_attendance_comment_flag.js
import fs from "fs";
import path from "path";

import { buildAttendanceStatusMap } from "../../../modules/common/visualizer/lib/buildAttendanceStatusMap.js";

export function addAttendanceCommentFlag(visualizerData, baseDir) {
  const lessonsPath = path.join(
    baseDir,
    "..",
    "..",
    "data",
    "lms_lessons_for_schedules.json"
  );

  if (!fs.existsSync(lessonsPath)) {
    return visualizerData;
  }

  const lessons = JSON.parse(fs.readFileSync(lessonsPath, "utf8"));
  const statusMap = buildAttendanceStatusMap(lessons);

  const enrichList = (list) =>
    list.map((v) => {
      const status = statusMap.get(v.scheduleKey);

      return {
        ...v,
        hasAttendanceComment: status?.hasAttendWithComment === true,
        hasAbsent: status?.hasAbsent === true,
      };
    });

  return {
    ...visualizerData,
    mine: enrichList(visualizerData.mine || []),
    past: enrichList(visualizerData.past || []),
    available: enrichList(visualizerData.available || []),
  };
}
