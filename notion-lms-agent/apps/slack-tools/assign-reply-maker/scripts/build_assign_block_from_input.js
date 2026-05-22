// apps/slack-tools/assign-reply-maker/scripts/build_assign_block_from_input.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { parseSlackLine } from "../core/parseSlackLine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .../notion-lms-agent/apps/slack-tools/assign-reply-maker
const baseDir = path.resolve(__dirname, "..");
const workDir = path.join(baseDir, "work");

const inputPath = path.join(workDir, "input.txt");
const outputPath = path.join(workDir, "assign_block.json");

// 1. input.txt 読み込み
if (!fs.existsSync(inputPath)) {
  console.error("❌ input.txt が見つかりません:", inputPath);
  process.exit(1);
}

const text = fs.readFileSync(inputPath, "utf-8");
const lines = text.split(/\r?\n/);

// 2. 「日付行＋コマ行＋URL行」のブロックを探す
let dateLine = null;
let infoLine = null;
let urlLine = null;

// 日付行のパターン： "■ 12/05(金)" みたいな形
const dateOnlyPattern = /^[■・]?\s*\d{2}\/\d{2}\(.+?\)\s*$/;
// コマ行のパターン： "16:00 【新潟】2025年7月開講(6ヶ月) 10回目/19回目"
const infoPattern =
  /(\d{1,2}:\d{2})\s+【.+?】\d{4}年\d+月開講.*\d+回目\/\d+回目/;
// URL行のパターン： http or https
const urlPattern = /^https?:\/\/\S+/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  if (!dateOnlyPattern.test(line)) continue;

  const next = lines[i + 1] ? lines[i + 1].trim() : "";
  const next2 = lines[i + 2] ? lines[i + 2].trim() : "";

  if (infoPattern.test(next) && urlPattern.test(next2)) {
    dateLine = line;
    infoLine = next;
    urlLine = next2;
    break;
  }
}

if (!dateLine || !infoLine || !urlLine) {
  console.error("❌ 日付＋コマ＋URL の3行セットが見つかりませんでした");
  process.exit(1);
}

console.log("🧾 見つかった3行セット:");
console.log(dateLine);
console.log(infoLine);
console.log(urlLine);
console.log("");

// 3. 日付行＋コマ行を結合して1行にする（パース用）
const mergedLine = `${dateLine.trim()} ${infoLine.trim()}`;
console.log("🔗 パース用に結合した行:");
console.log(mergedLine);
console.log("");

// 4. パース（date/time/area/month/回数など）
const parsed = parseSlackLine(mergedLine);

console.log("🧩 パース結果:");
console.log(parsed);
console.log("");

// 5. notionUrl を追加して JSON 化
const result = {
  ...parsed,
  notionUrl: urlLine.trim(),
  rawLines: {
    dateLine,
    infoLine,
    urlLine,
  },
};

// 6. work/assign_block.json に保存
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

console.log("💾 保存しました:", outputPath);
