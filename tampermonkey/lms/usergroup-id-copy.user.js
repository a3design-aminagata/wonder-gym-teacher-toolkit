// ==UserScript==
// @name         LMS : Common - Usergroup ID Copy
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  user_groupsテーブルの各行にIDコピー用ボタンを追加
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/user_groups*
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // 各行を取得
  document.querySelectorAll("table tbody tr").forEach((tr) => {
    const link = tr.querySelector('a[href*="/user_groups/"]');
    if (!link) return;

    // URLからIDを抽出
    const match = link.href.match(/user_groups\/(\d+)/);
    if (!match) return;
    const id = match[1];

    // ボタンを作成
    const btn = document.createElement("button");
    btn.textContent = `Copy ID (${id})`;
    btn.style.marginLeft = "8px";
    btn.style.padding = "2px 6px";
    btn.style.fontSize = "0.8rem";
    btn.style.cursor = "pointer";
    btn.style.borderRadius = "6px";
    btn.style.border = "1px solid #ccc";
    btn.style.background = "#eef";
    btn.style.transition = "all 0.2s ease";

    // hoverで少し色変化
    btn.addEventListener("mouseover", () => (btn.style.background = "#dde"));
    btn.addEventListener("mouseout", () => (btn.style.background = "#eef"));

    // クリックでコピー
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(id);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = `Copy ID (${id})`), 1000);
    });

    // 「ユーザーグループ名」のセルの下に追加
    const targetTd = tr.querySelectorAll("td")[1]; // 2列目（ユーザーグループ名）
    if (targetTd) {
      targetTd.appendChild(document.createElement("br"));
      targetTd.appendChild(btn);
    }
  });
})();
