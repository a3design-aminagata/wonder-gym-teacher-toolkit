// apps/slack-tools/assign-reply-maker/core/buildSlackReply.js

import { getUserGroupIdRuntime } from "./getUserGroupIdRuntime.js";
import {
  LMS_LESSON_EDIT_BASE_URL,
  LMS_USER_GROUPS_URL,
} from "../../../modules/lms/constants.js";

/**
 * Slack返信文を組み立てる
 * @param {object} params
 * @param {object} params.assignBlock  assign_block.json のオブジェクト
 * @param {number} params.selectedTimes  担当する回数 (例: 19)
 * @param {number|string} params.onlineLessonId  対面指導の online_lesson_id (例: 28593)
 * @param {string} [params.lecturerName="永田"] 講師名
 */
export async function buildSlackReply({
  assignBlock,
  selectedTimes,
  onlineLessonId,
  lecturerName = "永田",
}) {
  const { dateLabel, timeLabel, area, month, timesCandidates, notionUrl } =
    assignBlock;

  console.log("📦 assign_block.json 読み込み:");
  console.log(assignBlock);

  if (!timesCandidates.includes(selectedTimes)) {
    console.warn(
      `⚠ timesCandidates=${JSON.stringify(
        timesCandidates
      )} に selectedTimes=${selectedTimes} が含まれていません`
    );
  }

  const userGroupId = await getUserGroupIdRuntime({
    area,
    month,
    selectedTimes,
  });

  const userGroupUrl = `${LMS_USER_GROUPS_URL}/${userGroupId}?number_of_times=${selectedTimes}`;
  const lessonEditUrl = `${LMS_LESSON_EDIT_BASE_URL}/${onlineLessonId}/edit`;

  const dateTimeLabel =
    dateLabel && timeLabel ? `${dateLabel} ${timeLabel}` : timeLabel;

  const text = `
@熊谷菜津美/デザイナー(Natsumi Kumagai)
いつも調整ありがとうございます！

${dateTimeLabel} の対面授業、対応可能です:ok_女性:
自分の名前をLMSに登録しました！

■ ${selectedTimes}回目の対面指導 URL
${userGroupUrl}

■ 今回の対面指導 URL
${lessonEditUrl}

（参考）Notionページ
${notionUrl}

明日、授業させていただきます。
よろしくお願いいたします！:祈る:
`.trim();

  return { text, userGroupUrl, lessonEditUrl };
}
