// ==UserScript==
// @name         Notion : スケジュールセルクリックでLMSページを開く
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  Notionのスケジュール表で開講コースをクリックするとLMSページを開く
// @match        https://*.notion.site/*
// @match        https://*.notion.so/*
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // 全角数字 → 半角に変換
  function zenkakuToHankaku(str) {
    return str.replace(/[０-９]/g, function (s) {
      return String(s.charCodeAt(0) - 0xfee0);
    });
  }

  // 抽出に使用するカテゴリ語のリスト（|で結合して正規表現の文字列として利用）
  const CATEGORY_TERMS = "デザイン|マーケ";

  const observer = new MutationObserver(() => {
    document.querySelectorAll('div[role="cell"]').forEach((cell) => {
      if (cell.dataset.clickAdded === "true") return;

      const rawText = cell.innerText || "";
      const norm = zenkakuToHankaku(rawText.trim());

      // 1. 月の表記があるかチェック
      if (!/(\d{1,2})月/.test(norm)) return;

      // 2. カテゴリ語がテキスト内に含まれているかチェック
      const isTarget = new RegExp(`(${CATEGORY_TERMS})`).test(norm);

      if (isTarget) {
        cell.dataset.clickAdded = "true";
        cell.style.cursor = "pointer";
        cell.style.textDecoration = "underline";

        cell.addEventListener("click", () => {
          // --- 月の抽出 ---
          const monthRawMatch = norm.match(/(\d{1,2})月/);
          let month = "";
          if (monthRawMatch && monthRawMatch[1]) {
            const n = parseInt(monthRawMatch[1], 10);
            if (!Number.isNaN(n)) month = String(n);
          }

          // --- 都道府県の抽出 ---
          // 月とカテゴリ語に挟まれた部分を抽出
          const prefectureMatch = norm.match(
            new RegExp(`月\\s*([^0-9\\n\\r\\t]+?)(${CATEGORY_TERMS}|$)`)
          );
          let prefecture = "";
          if (prefectureMatch && prefectureMatch[1]) {
            prefecture = prefectureMatch[1].trim();
          } else {
            // フォールバック：月の後の最初の単語を都道府県とみなす
            const fb = norm.match(/月\s*([^\s\/\n\r\t]+)/);
            if (fb && fb[1]) prefecture = fb[1].trim();
          }

          if (month && prefecture) {
            const url = `https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/user_groups?prefecture=${encodeURIComponent(
              prefecture
            )}&year=&month=${month}`;
            window.open(url, "_blank");
          } else {
            alert(
              "都道府県または月の情報が取得できませんでした。\n取得テキスト：" +
                rawText
            );
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
