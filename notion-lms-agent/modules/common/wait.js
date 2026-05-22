/**
 * 共通 wait ユーティリティ
 * - Puppeteer / Playwright / Node の差分を吸収するため
 * - page.waitForTimeout を使わないために存在する
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
