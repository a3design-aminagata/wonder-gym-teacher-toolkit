// modules/notion/filterActions.js

import { wait } from "../../../common/wait.js";

/**
 * Notion の UI が innerText を持つまで待つ
 */
export async function waitForInnerText(
  page,
  selector,
  keyword,
  timeout = 5000
) {
  const start = Date.now();
  const hasKeyword = Boolean(keyword);

  while (Date.now() - start < timeout) {
    const found = await page.evaluate(
      ({ selector, keyword, hasKeyword }) => {
        const els = Array.from(document.querySelectorAll(selector));
        if (!els.length) return false;
        if (!hasKeyword) return true;
        return els.some((el) => (el.innerText || "").includes(keyword));
      },
      { selector, keyword, hasKeyword }
    );

    if (found) return true;

    await wait(80);
  }

  return false;
}

async function clickWithRetry(
  page,
  label,
  evaluateFn,
  { timeoutMs = 10000, pollMs = 250, logEveryMs = 4000 } = {}
) {
  const start = Date.now();
  let nextProgressAt = start + logEveryMs;

  while (Date.now() - start < timeoutMs) {
    if (page.isClosed?.()) {
      console.log(`❌ ${label} 探索中にページが閉じました`);
      return false;
    }

    try {
      const clicked = await page.evaluate(evaluateFn);
      if (clicked) {
        console.log(`✅ ${label} をクリックしました`);
        return true;
      }
    } catch {
      // Notion の再描画中に evaluate が失敗することがあるため次ループで再試行
    }

    const now = Date.now();
    if (now >= nextProgressAt) {
      const elapsedSec = Math.floor((now - start) / 1000);
      console.log(`⏳ ${label} 待機中... (${elapsedSec}s)`);
      nextProgressAt = now + logEveryMs;
    }

    await wait(pollMs);
  }

  console.log(`❌ ${label} が見つかりませんでした`);
  return false;
}

export async function openFilterMenu(page, { timeoutMs = 12000 } = {}) {
  console.log("🔍 フィルターアイコンを探しています…");

  return clickWithRetry(
    page,
    "フィルターアイコン",
    () => {
      const normalize = (s) => (s || "").replace(/\s+/g, "").toLowerCase();
      const isVisible = (el) => el && el.getClientRects().length > 0;

      const buttons = Array.from(document.querySelectorAll('[role="button"]')).filter(
        isVisible
      );

      const byAria = buttons.find((el) => {
        const aria = normalize(el.getAttribute("aria-label"));
        return (
          aria === "フィルター" ||
          aria === "フィルタ" ||
          aria === "filter" ||
          aria === "filters"
        );
      });

      if (byAria) {
        byAria.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }

      const byText = buttons.find((el) => {
        const text = normalize(el.innerText || el.textContent || "");
        return text === "フィルター" || text === "フィルタ" || text === "filter";
      });

      if (!byText) return false;

      byText.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    },
    { timeoutMs }
  );
}

export async function clickAddFilter(page, { timeoutMs = 12000 } = {}) {
  console.log("➕ ＋フィルター（実際は『フィルター』ボタン）を探しています…");

  return clickWithRetry(
    page,
    "＋フィルター",
    () => {
      const normalize = (s) => (s || "").replace(/\s+/g, "").toLowerCase();
      const isVisible = (el) => el && el.getClientRects().length > 0;

      const buttons = Array.from(document.querySelectorAll('[role="button"]')).filter(
        isVisible
      );

      const candidates = buttons.filter((btn) => {
        const text = normalize(btn.innerText || btn.textContent || "");
        return (
          text === "フィルター" ||
          text === "フィルタ" ||
          text === "addfilter" ||
          text === "+addfilter" ||
          text === "addafilter"
        );
      });

      if (!candidates.length) return false;

      const withPlusIcon = candidates.find((btn) =>
        btn.querySelector(
          "svg.plusSmall, svg[class*='plus'], [data-testid*='plus'], [class*='plusSmall']"
        )
      );

      const target = withPlusIcon || candidates[candidates.length - 1];
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    },
    { timeoutMs }
  );
}

/**
 * 「フィルター追加」内のプロパティ選択で「講師名」をクリックする
 */
export async function selectPropertyTeacher(page) {
  console.log("📌 フィルター項目『講師名』を探しています…");

  // ▼ role="option" に「講師名」が出るまで待つ
  const ready = await waitForInnerText(
    page,
    'div[role="option"]',
    "講師名",
    7000
  );

  if (!ready) {
    console.log("❌ 『講師名』が表示される前にタイムアウト");
    return false;
  }

  // ▼ 実際にクリック
  const clicked = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('div[role="option"]'));

    const target = options.find((opt) => {
      const text = (opt.innerText || "").trim();
      return text.includes("講師名");
    });

    if (target) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
    return false;
  });

  if (clicked) console.log("✅ プロパティ『講師名』を選択しました");
  else console.log("❌ 『講師名』が見つかりませんでした");

  return clicked;
}

/**
 * 講師名（講師名サンプルなど）を選択する
 */
export async function chooseTeacherName(page, teacherName) {
  console.log(`👤 講師名『${teacherName}』を探しています…`);

  // ▼ role="option" に値（講師名）が出るまで待つ
  const ready = await waitForInnerText(
    page,
    'div[role="option"]',
    teacherName,
    7000
  );

  if (!ready) {
    console.log(`❌ 講師名『${teacherName}』が表示される前にタイムアウト`);
    return false;
  }

  // ▼ 実際にクリック
  const clicked = await page.evaluate((name) => {
    const options = Array.from(document.querySelectorAll('div[role="option"]'));
    const target = options.find((opt) =>
      (opt.innerText || "").trim().includes(name)
    );

    if (!target) return false;

    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  }, teacherName);

  if (clicked) console.log(`✅ 講師名『${teacherName}』を選択しました`);
  else console.log(`❌ 講師名『${teacherName}』が見つかりませんでした`);

  return clicked;
}

export async function clickDatePill(page) {
  console.log("🔍 日付 pill（今後 2 か月間）を探しています…");

  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"]'));

    for (const btn of btns) {
      const span = btn.querySelector("span");
      if (!span) continue;

      const txt = span.innerText.replace(/\s+/g, "").trim();

      // 「日付:今後2か月間」と一致するか？
      if (
        txt.includes("日付") &&
        txt.includes("今後") &&
        txt.includes("か月間")
      ) {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }
    }
    return false;
  });

  if (clicked) console.log("✅ 日付 pill をクリックしました");
  else console.log("❌ 日付 pill が見つかりませんでした");

  return clicked;
}
