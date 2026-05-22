// modules/lms/auth/loginLms.js
import { launchBrowser } from "../../common/browser.js";
import { wait } from "../../common/wait.js";
import { LMS_LOGIN_URL } from "../constants.js";

export async function openLmsSession() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await loginLms(page);
  return { browser, page };
}

export async function loginLms(page) {
  const LOGIN_EMAIL = process.env.LOGIN_EMAIL;
  const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;

  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.error("❌ LOGIN_EMAIL / LOGIN_PASSWORD が .env から読めません");
    process.exit(1);
  }

  // 「重い日」対策：ここは navigation じゃなくても効くのでOK
  page.setDefaultTimeout(90000);

  console.log("🌐 LMS ログインページへアクセス中…");
  await page.goto(LMS_LOGIN_URL, { waitUntil: "networkidle2" });

  // すでにログイン済みならフォームが出ない
  const emailInput = await page.$('input[type="email"]');
  if (!emailInput) {
    console.log("ℹ 既にログイン済みと判断します");
    return page;
  }

  console.log("📩 メール / パスワード入力");
  await page.type('input[type="email"]', LOGIN_EMAIL, { delay: 30 });
  await page.type('input[type="password"]', LOGIN_PASSWORD, { delay: 30 });

  await page.click('button[type="submit"]');

  // 「遷移する/しない」の両方を吸収してログイン完了判定
  await Promise.race([
    page.waitForFunction(() => !location.pathname.includes("/login"), {
      timeout: 90000,
    }),
    page.waitForSelector('input[type="email"]', {
      hidden: true,
      timeout: 90000,
    }),
  ]);

  // 描画の揺れ吸収（Reminder: puppeteer v24 で waitForTimeout は無い）
  await wait(500);

  console.log("✅ LMS ログイン完了");
  return page;
}
