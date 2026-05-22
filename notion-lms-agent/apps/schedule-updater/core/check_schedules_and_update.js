// scripts/check_schedules_and_update.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..", "..");
const dataDir = path.join(projectRoot, "data");

const LIGHT_PATH = path.join(dataDir, "schedules_light.json");
const STATE_PATH = path.join(dataDir, "schedules_light_state.json");

console.log("🚨 check_schedules_and_update.js loaded");

async function readJsonIfExists(filePath) {
  try {
    const txt = await fs.readFile(filePath, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  console.log("🔁 schedules_light.json を再生成します…");
  // build_schedules_light.js を実行
  execSync("node apps/schedule-updater/core/build_schedules_light.js", {
    cwd: projectRoot,
    stdio: "inherit",
  });

  // 生成された schedules_light.json を読む
  console.log("📄 read target =", path.resolve(LIGHT_PATH));

  const light = await readJsonIfExists(LIGHT_PATH);
  if (!light || !Array.isArray(light) || light.length === 0) {
    console.log(
      "⚠ schedules_light.json が空 or 読み込めませんでした。何もしません。"
    );
    return;
  }

  // 今回の「最大 iso」を求める
  const maxIsoCurrent = light
    .map((item) => item?.date?.iso)
    .filter(Boolean)
    .sort() // ISO文字列はそのままソートで OK（昇順）
    .pop();

  if (!maxIsoCurrent) {
    console.log("⚠ date.iso が見つかりませんでした。何もしません。");
    return;
  }

  console.log(`📌 今回の最大日付: ${maxIsoCurrent}`);

  // 前回の状態を読む（なければ初回）
  const state = await readJsonIfExists(STATE_PATH);

  if (!state || !state.lastMaxIso) {
    console.log(
      "🆕 初回 or 状態ファイルなし → 状態だけ保存して終了します（重い scrape はまだしない）"
    );
    await writeJson(STATE_PATH, { lastMaxIso: maxIsoCurrent });
    return;
  }

  const prevIso = state.lastMaxIso;
  console.log(`📁 前回記録した最大日付: ${prevIso}`);

  if (maxIsoCurrent <= prevIso) {
    console.log(
      "✅ 最大日付は増えていません → 次月コマはまだ増えていないと判断。何もしません。"
    );
    return;
  }

  // ここまで来たら「最大日付が前回より後ろに伸びた」＝新しいコマが追加された
  console.log(
    "🚀 最大日付が更新されました！重い scrape（update:schedules:all）を実行します…"
  );

  execSync("npm run update:schedules:all", {
    cwd: projectRoot,
    stdio: "inherit",
  });

  // 状態を更新
  await writeJson(STATE_PATH, { lastMaxIso: maxIsoCurrent });
  console.log("💾 状態ファイルを更新しました。");
}

main().catch((err) => {
  console.error("💥 check_schedules_and_update でエラー:", err);
  process.exit(1);
});
