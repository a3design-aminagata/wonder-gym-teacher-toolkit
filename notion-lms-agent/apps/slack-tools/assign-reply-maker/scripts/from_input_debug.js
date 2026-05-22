// apps/slack-tools/assign-reply-maker/scripts/from_input_debug.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { parseSlackLine } from "../core/parseSlackLine.js";
import { makeLmsListUrl } from "../core/makeLmsListUrl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname = .../apps/slack-tools/assign-reply-maker/scripts
// → baseDir = .../apps/slack-tools/assign-reply-maker
const baseDir = path.resolve(__dirname, "..");

// work ディレクトリ
const workDir = path.join(baseDir, "work");
const inputPath = path.join(workDir, "input.txt");
const parsedPath = path.join(workDir, "assign_from_input.json");

// 1. input.txt 読み込み
if (!fs.existsSync(inputPath)) {
  console.error("❌ input.txt が見つかりません:", inputPath);
  process.exit(1);
}

const text = fs.readFileSync(inputPath, "utf-8");
const lines = text.split(/\r?\n/);

// 2. 「Slack のコマ行っぽい」行を探す
const targetLine = lines.find((line) =>
  /【.+?】\d{4}年\d+月開講.*\d+回目\/\d+回目/.test(line)
);

if (!targetLine) {
  console.error("❌ Slack のコマ行が見つかりませんでした");
  process.exit(1);
}

console.log("🔍 見つかった行:");
console.log(targetLine);
console.log("");

// 3. パース
const info = parseSlackLine(targetLine);

console.log("🧩 パース結果:");
console.log(info);
console.log("");

// 4. 一覧URLも確認
const listUrl = makeLmsListUrl({ month: info.month, area: info.area });
console.log("📎 一覧URL:");
console.log(listUrl);

// 5. ついでに work/assign_from_input.json として保存しておく
if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}
fs.writeFileSync(parsedPath, JSON.stringify(info, null, 2), "utf-8");

console.log("");
console.log("💾 パース結果を保存しました:", parsedPath);
