// apps/slack-tools/assign-reply-maker/core/getUserGroupIdRuntime.js

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { launchBrowser } from "../../../modules/common/browser.js";
import { wait } from "../../../modules/common/wait.js";
import { LMS_USER_GROUPS_URL } from "../../../modules/lms/constants.js";
import { makeLmsListUrl } from "./makeLmsListUrl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルート: .../notion-lms-agent
const projectRoot = path.resolve(__dirname, "..", "..", "..");

// .env は repo-root/.env を想定
const envPath = path.join(projectRoot, "..", ".env");
dotenv.config({ path: envPath });

const LOGIN_EMAIL = process.env.LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;

if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error("❌ LOGIN_EMAIL または LOGIN_PASSWORD が .env にありません");
  process.exit(1);
}

async function loginToLms(page) {
  console.log("🌐 LMS にアクセスしログインします…");

  await page.goto(
    LMS_USER_GROUPS_URL,
    { waitUntil: "networkidle2" }
  );

  await page.waitForSelector('input[type="email"]', { timeout: 15000 });

  await page.type('input[type="email"]', LOGIN_EMAIL, { delay: 50 });
  await page.type('input[type="password"]', LOGIN_PASSWORD, { delay: 50 });

  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  console.log("✅ ログイン完了！");
}

/**
 * area, month, selectedTimes から user_group ID を取得
 * @param {{ area: string, month: number, selectedTimes: number }} params
 * @returns {Promise<string>} user_group_id
 */
export async function getUserGroupIdRuntime({ area, month, selectedTimes }) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await loginToLms(page);

    const listUrl = makeLmsListUrl({ month, area });
    console.log("🔗 一覧URL:", listUrl);

    await page.goto(listUrl, { waitUntil: "networkidle2" });
    await wait(1200);

    // table の中から /user_groups/xxx を抜き出す
    const ids = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));

      return rows
        .map((tr) => {
          const link = tr.querySelector('a[href*="/user_groups/"]');
          if (!link) return null;
          const m = link.href.match(/user_groups\/(\d+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
    });

    console.log("🧾 一覧から取得した user_group IDs:", ids);

    const index = selectedTimes - 1;
    const userGroupId = ids[index];

    if (!userGroupId) {
      throw new Error(
        `selectedTimes=${selectedTimes} に対応する user_group ID が見つかりません（index=${index}, ids.length=${ids.length}）`
      );
    }

    console.log(`✅ ${selectedTimes}回目 -> user_group_id = ${userGroupId}`);
    return userGroupId;
  } finally {
    await browser.close();
  }
}
