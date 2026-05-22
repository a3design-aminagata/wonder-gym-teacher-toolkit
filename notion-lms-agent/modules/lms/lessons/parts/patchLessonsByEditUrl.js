// modules/lms/lessons/parts/patchLessonsByEditUrl.js

export function patchLessonsByEditUrl(allData, patchData) {
  const groupMap = new Map(); // scheduleKey -> sched
  const lessonMap = new Map(); // editUrl -> lesson

  // --- index existing ---
  for (const sched of allData) {
    groupMap.set(sched.scheduleKey, sched);
    for (const lesson of sched.matchedLessons || []) {
      if (lesson.editUrl) {
        lessonMap.set(lesson.editUrl, lesson);
      }
    }
  }

  let patched = 0;
  let added = 0;

  for (const patchSched of patchData) {
    let targetSched = groupMap.get(patchSched.scheduleKey);

    // --- group が無ければ追加 ---
    if (!targetSched) {
      allData.push({
        ...patchSched,
        matchedLessons: [...patchSched.matchedLessons],
      });
      groupMap.set(patchSched.scheduleKey, allData.at(-1));
      added += patchSched.matchedLessons.length;
      continue;
    }

    // --- lesson 単位で処理 ---
    for (const lesson of patchSched.matchedLessons || []) {
      if (!lesson.editUrl) continue;

      const target = lessonMap.get(lesson.editUrl);

      if (target) {
        // patch
        target.attendance = lesson.attendance;
        target.motivation = lesson.motivation;
        target.progress = lesson.progress;
        target.comment = lesson.comment;
        patched++;
      } else {
        // add
        targetSched.matchedLessons.push({ ...lesson });
        lessonMap.set(lesson.editUrl, lesson);
        added++;
      }
    }
  }

  console.log(`🩹 patched: ${patched}, ➕ added: ${added}`);
}
