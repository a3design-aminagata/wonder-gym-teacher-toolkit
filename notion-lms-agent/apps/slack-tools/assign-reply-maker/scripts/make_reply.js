// apps/slack-tools/assign-reply-maker/scripts/make_reply.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildSlackReply } from "../core/buildSlackReply.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.resolve(__dirname, ".."); // .../apps/slack-tools/assign-reply-maker
const workDir = path.join(baseDir, "work");

const assignBlockPath = path.join(workDir, "assign_block.json");
const replyPath = path.join(workDir, "reply.txt");

// 引数：node make_reply.js 19 28593
const [, , timesArg, lessonIdArg] = process.argv;

if (!timesArg || !lessonIdArg) {
  console.error(
    "使い方: node apps/slack-tools/assign-reply-maker/scripts/make_reply.js <回数> <online_lesson_id>"
  );
  console.error("例: node .../make_reply.js 19 28593");
  process.exit(1);
}

const selectedTimes = Number(timesArg);
const onlineLessonId = lessonIdArg;

if (!fs.existsSync(assignBlockPath)) {
  console.error("❌ assign_block.json が見つかりません:", assignBlockPath);
  process.exit(1);
}

const raw = fs.readFileSync(assignBlockPath, "utf-8");
const assignBlock = JSON.parse(raw);

(async () => {
  try {
    const { text, userGroupUrl, lessonEditUrl } = await buildSlackReply({
      assignBlock,
      selectedTimes,
      onlineLessonId,
      lecturerName: "永田",
    });

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    fs.writeFileSync(replyPath, text, "utf-8");

    console.log("✅ Slack返信文を生成しました:");
    console.log("------------");
    console.log(text);
    console.log("------------");
    console.log("💾 保存先:", replyPath);
    console.log("🔗 19回目URL:", userGroupUrl);
    console.log("🔗 対面指導編集URL:", lessonEditUrl);
  } catch (err) {
    console.error("❌ 返信文生成中にエラー:", err);
    process.exit(1);
  }
})();
