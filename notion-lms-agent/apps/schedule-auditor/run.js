import fs from "fs";
import path from "path";
import { openLmsSession } from "../../modules/lms/auth/loginLms.js";
import { scrapeDecidedSchedules } from "../../modules/lms/decided-schedules/scrapeDecidedSchedules.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    args[key] = val;
  }
  return args;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function normTime(t) {
  if (!t) return null;
  const m = String(t)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(t).trim();
  return `${Number(m[1])}:${m[2]}`;
}

function filterByYearMonth(items, year, month) {
  const ym = `${year}-${pad2(month)}`;
  return items.filter((x) => (x.date || "").startsWith(ym));
}

function makeKeyFromLms(r) {
  // 判定対象：date/time/area/開講月
  return [r.date, normTime(r.time), r.area, Number(r.courseStartMonth)].join(
    "|"
  );
}

function monthFromCourseString(course) {
  // 例: "07月千葉マーケ" -> 7, "7月山口マーケ" -> 7
  const m = String(course || "").match(/^(\d{1,2})月/);
  return m ? Number(m[1]) : null;
}

function makeKeyFromJson(r) {
  // JSONは month を正とする（course先頭の月は診断用に使える）
  const m1 = Number(r.month);
  const _m2 = monthFromCourseString(r.course); // 今は未使用。必要なら出力に使う
  return [r.date, normTime(r.time), r.area, m1].join("|");
}

function compare(lmsRows, jsonRows) {
  const lmsMap = new Map();
  const jsonMap = new Map();

  for (const r of lmsRows) {
    const k = makeKeyFromLms(r);
    if (!lmsMap.has(k)) lmsMap.set(k, []);
    lmsMap.get(k).push(r);
  }

  for (const r of jsonRows) {
    const k = makeKeyFromJson(r);
    if (!jsonMap.has(k)) jsonMap.set(k, []);
    jsonMap.get(k).push(r);
  }

  const keys = new Set([...lmsMap.keys(), ...jsonMap.keys()]);
  const missingInJson = [];
  const extraInJson = [];

  for (const k of keys) {
    const l = lmsMap.get(k) || [];
    const j = jsonMap.get(k) || [];

    if (l.length === 0 && j.length > 0) {
      for (const item of j) extraInJson.push({ key: k, item });
    } else if (j.length === 0 && l.length > 0) {
      for (const item of l) missingInJson.push({ key: k, item });
    }
  }

  return { missingInJson, extraInJson };
}

function printResult({
  year,
  month,
  lmsUrl,
  invalidLms,
  missingInJson,
  extraInJson,
}) {
  console.log("=== schedule-auditor ===");
  console.log(`Target: ${year}-${pad2(month)}`);
  console.log(`LMS: ${lmsUrl}`);
  console.log(`Invalid LMS rows: ${invalidLms.length}`);
  console.log(`missingInJson: ${missingInJson.length}`);
  console.log(`extraInJson:   ${extraInJson.length}`);

  if (invalidLms.length) {
    console.log("\n--- Invalid LMS rows (missing fields) ---");
    for (const r of invalidLms.slice(0, 20)) {
      console.log(
        `- ${r._rawDateTimeText} / ${r.userGroupName} / 回数=${r.numberOfTimes}`
      );
    }
    if (invalidLms.length > 20)
      console.log(`... and ${invalidLms.length - 20} more`);
  }

  if (missingInJson.length) {
    console.log(
      "\n--- Missing in schedules_enriched.json (present in LMS) ---"
    );
    for (const x of missingInJson) {
      const r = x.item;
      console.log(`- ${x.key}`);
      console.log(
        `  LMS: ${r._rawDateTimeText} / ${r.userGroupName} / 回数=${r.numberOfTimes}`
      );
      console.log(`  出欠: ${r.attendanceEditUrl ?? ""}`);
    }
  }

  if (extraInJson.length) {
    console.log("\n--- Extra in schedules_enriched.json (absent in LMS) ---");
    for (const x of extraInJson) {
      const r = x.item;
      console.log(`- ${x.key}`);
      console.log(
        `  JSON: ${r.date} ${r.time} / area=${r.area} month=${r.month} count=${r.count?.current}/${r.count?.total}`
      );
      console.log(`  lmsUrl: ${r.lmsUrl}`);
    }
  }

  const ok =
    missingInJson.length === 0 &&
    extraInJson.length === 0 &&
    invalidLms.length === 0;
  console.log("\nstatus:", ok ? "OK (一致)" : "NG (差分/不正行あり)");
  return ok;
}

async function main() {
  const args = parseArgs(process.argv);

  // year/month が未指定なら「次の月」を自動でターゲットにする
  const now = new Date(); // ローカル時間（あなたの環境はJST）
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 次月1日
  const defaultYear = next.getFullYear();
  const defaultMonth = next.getMonth() + 1;

  const year = args.year ? Number(args.year) : defaultYear;
  const month = args.month ? Number(args.month) : defaultMonth;

  const jsonPath = args.json || "data/schedules_enriched.json";

  const jsonAbs = path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(jsonAbs)) {
    console.error(`Error: json not found: ${jsonAbs}`);
    process.exit(2);
  }

  const enrichedAll = JSON.parse(fs.readFileSync(jsonAbs, "utf-8"));
  const enriched = filterByYearMonth(enrichedAll, year, month);
  if (enriched.length === 0) {
    console.error(
      `Error: JSON has no rows for target month: ${year}-${pad2(
        month
      )} (json=${jsonAbs})`
    );
    process.exit(2);
  }

  const { browser, page } = await openLmsSession();

  try {
    const {
      url: lmsUrl,
      rows: lmsAll,
      invalid: invalidLms,
    } = await scrapeDecidedSchedules(page, { year, month });
    const lms = filterByYearMonth(lmsAll, year, month);

    const { missingInJson, extraInJson } = compare(lms, enriched);

    const ok = printResult({
      year,
      month,
      lmsUrl,
      invalidLms,
      missingInJson,
      extraInJson,
    });
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
