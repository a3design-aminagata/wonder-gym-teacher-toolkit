// modules/notify/buildAttendUrls.js
import fs from "fs";
import { LMS_USER_GROUPS_URL } from "../lms/constants.js";

const FIXED_TODAY = "2025-12-01"; // ← 今は固定でテスト

export function buildAttendUrls() {
  const schedules = JSON.parse(fs.readFileSync("schedules.json", "utf-8"));
  const groups = JSON.parse(
    fs.readFileSync("courses_with_group_ids.json", "utf-8")
  );

  const results = [];

  // ① 今日（固定日）の授業だけ抽出
  const todaysLessons = schedules.filter((item) =>
    item.date.iso.startsWith(FIXED_TODAY)
  );

  for (const lesson of todaysLessons) {
    const course = lesson.course;
    const total = lesson.count.total; // number_of_times は total を使う

    // ② userGroupIds を取得
    const groupInfo = groups.find((g) => g.courseKey === course);
    if (!groupInfo) {
      console.log(`⚠ userGroupIds が見つからない: ${course}`);
      continue;
    }

    const userGroupId = groupInfo.userGroupIds[0]; // ← 最初だけ使う

    // ③ URL を生成
    const attendUrl = `${LMS_USER_GROUPS_URL}/${userGroupId}?number_of_times=${total}`;

    results.push({
      course,
      iso: lesson.date.iso,
      userGroupId,
      number_of_times: total,
      attendUrl,
    });
  }

  // ④ JSON で保存
  fs.writeFileSync(
    "attend_urls.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("🎉 attend_urls.json を作成しました！");
  return results;
}

// CLI 実行用
if (process.argv[1].includes("buildAttendUrls.js")) {
  buildAttendUrls();
}
