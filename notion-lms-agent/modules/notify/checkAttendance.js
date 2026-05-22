// modules/notify/checkAttendance.js
import fs from "fs";
import { launchBrowser } from "../common/browser.js";
import { wait } from "../common/wait.js";
import { loginLms } from "../lms/auth/loginLms.js";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const TEACHER_NAME = process.env.NAME;

if (!TEACHER_NAME) {
  console.error("❌ .env の NAME が読み込めていません");
  process.exit(1);
}

export async function checkAttendance() {
  const attendList = JSON.parse(fs.readFileSync("attend_urls.json", "utf-8"));
  const browser = await launchBrowser(false);
  const page = await browser.newPage();

  // ★ ログイン
  await loginLms(page);

  const results = [];

  for (const item of attendList) {
    console.log(`\n🔍 チェック中: ${item.attendUrl}`);

    await page.goto(item.attendUrl, { waitUntil: "networkidle2" });
    await wait(800);

    const rows = await page.$$eval("table tbody tr", (trs) =>
      trs.map((tr) => {
        const tds = Array.from(tr.querySelectorAll("td")).map((td) =>
          td.innerText.trim()
        );
        return { tds };
      })
    );

    // ★ NAME の行を探す
    const myRow = rows.find((r) => r.tds[4] === TEACHER_NAME);

    if (!myRow) {
      console.log("⚠ あなたの行が見つからない");
      continue;
    }

    const attendance = myRow.tds[7];

    if (!attendance) {
      console.log("❗ 出欠が未入力 → 通知対象");
    } else {
      console.log(`✔ 出欠あり → 「${attendance}」`);
    }

    results.push({
      url: item.attendUrl,
      iso: item.iso,
      attendance,
      notify: !attendance,
    });
  }

  await browser.close();

  fs.writeFileSync(
    "attendance_check_result.json",
    JSON.stringify(results, null, 2)
  );

  console.log("\n🎉 attendance_check_result.json を作成しました");
}

if (process.argv[1].includes("checkAttendance.js")) {
  checkAttendance();
}
