// apps/schedule-updater/core/build_schedules_light.js
import { launchBrowser } from "../../../modules/common/browser.js";
import { wait } from "../../../modules/common/wait.js";
import { saveJSON } from "../../../modules/common/saveUtils.js";

import {
  applyTeacherFilter,
  fetchTimelineMetaOnly,
} from "../../../modules/notion/internal/scrape/scrapeCommon.js";

import {
  parseRaw,
  parseCourse,
  parseDate,
  parseCount,
} from "../../../modules/notion/internal/parse/parseUtils.js";
import { NOTION_VIEW_URL } from "../../../modules/notion/scrape/schedule/constants.js";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  console.log("🌐 Notion タイムライン（今後2か月）を開きます…");
  await page.goto(NOTION_VIEW_URL, { waitUntil: "networkidle2" });
  await wait(1500);

  const ok = await applyTeacherFilter(page);
  if (!ok) {
    console.log("❌ 講師が見つからないので終了します。");
    await browser.close();
    process.exit(1);
  }

  console.log("📥 タイムライン（light版）を取得します…");
  const results = await fetchTimelineMetaOnly(page, {
    parseRaw,
    parseCourse,
    parseDate,
    parseCount,
  });

  await browser.close();

  // data/schedules_light.json に保存
  await saveJSON("schedules_light.json", results);
  console.log("🎉 schedules_light.json を保存しました（detail なし版）");
}

main().catch((err) => {
  console.error("💥 build_schedules_light でエラー:", err);
  process.exit(1);
});
