// ==UserScript==
// @name         Notion : Auto click "さらに読み込む"
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  Notionで「さらに読み込む」を自動クリックして全件読み込む
// @match        https://*.notion.site/*
// @match        https://*.notion.so/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  const MAX_ATTEMPTS = 200; // 最大チェック回数（多めに）
  const INTERVAL_MS = 800; // 自動チェック間隔

  let attempts = 0;

  // 「さらに読み込む」を探してクリックする関数
  function clickLoadMore() {
    const buttons = Array.from(
      document.querySelectorAll('button, [role="button"]')
    );
    for (const btn of buttons) {
      const txt = (btn.innerText || btn.textContent || "").trim();
      if (txt.includes("さらに読み込む") || txt.includes("Load more")) {
        btn.click();
        console.log("[AutoLoadMore] さらに読み込むをクリックしました");
        return true;
      }
    }
    return false;
  }

  // 定期チェック
  const intervalId = setInterval(() => {
    attempts++;
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(intervalId);
      console.log("[AutoLoadMore] 最大試行回数に到達。停止します。");
      return;
    }
    clickLoadMore();
  }, INTERVAL_MS);

  // --- イベントでトリガー ---
  const triggerCheck = () => {
    attempts = 0; // 操作後は試行回数リセット
    clickLoadMore();
  };

  // ユーザー操作を監視
  window.addEventListener("click", triggerCheck, true);
  window.addEventListener("scroll", triggerCheck, { passive: true });
  window.addEventListener("keydown", triggerCheck);

  console.log("[AutoLoadMore] スクリプト起動中...");
})();
