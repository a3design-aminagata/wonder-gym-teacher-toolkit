// ==UserScript==
// @name         Notion : faviconをデフォルトに戻す（限定）
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  特定ページだけ favicon を Notion デフォルトに戻す
// @include      https://*.notion.site/*
// @include      https://www.notion.so/*
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // Notionのデフォルトfavicon
  const defaultFavicon = "https://www.notion.so/images/favicon.ico";

  function replaceFavicon() {
    // 既存のfaviconを削除
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((el) => el.remove());

    // 新しいfaviconを追加
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = defaultFavicon;
    document.head.appendChild(link);
  }

  // 初回実行
  replaceFavicon();

  // ページ遷移やfavicon変化にも対応
  const observer = new MutationObserver(() => {
    const currentHref = document.querySelector('link[rel="icon"]')?.href || "";
    if (!currentHref.includes("notion.so/images/favicon.ico")) {
      replaceFavicon();
    }
  });
  observer.observe(document.head, { childList: true, subtree: true });
})();
