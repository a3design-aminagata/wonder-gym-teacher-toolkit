// ==UserScript==
// @name         Notion : LMSグループIDリンク追加＋リンク作成
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  Notion右ペインにグループID入力欄を追加し、LMSの該当ページを開くボタンを設置
// @match        https://*.notion.site/*
// @match        https://www.notion.so/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  "use strict";

  function findH1Number() {
    const h1s = Array.from(document.querySelectorAll("h1"));
    for (const h of h1s) {
      const txt = (h.innerText || "").trim();
      if (!txt) continue;
      const m =
        txt.match(/[\/／]\s*(\d+)/) || txt.match(/(?:\D|^)(\d+)\s*回目/);
      if (m) return m[1];
    }
    return "";
  }

  setInterval(() => {
    try {
      const rows = Array.from(document.querySelectorAll('[role="row"]'));
      if (!rows.length) return;
      const numberOfTimes = findH1Number();

      for (const row of rows) {
        const text = (row.innerText || "").replace(/\s+/g, " ").trim();
        if (!text.includes("開講コース")) continue;
        if (row.nextElementSibling?.classList.contains("group-id-container"))
          continue;

        let courseName = "";
        const span = row.querySelector("span");
        if (span && span.innerText.trim()) {
          courseName = span.innerText.trim();
        } else {
          const idx = text.indexOf("開講コース");
          courseName =
            idx >= 0
              ? text
                  .slice(idx + "開講コース".length)
                  .trim()
                  .split("\n")[0]
                  .trim()
              : text;
        }

        const savedId = GM_getValue(courseName, "");

        const container = document.createElement("div");
        container.className = "group-id-container";
        Object.assign(container.style, {
          marginTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "10px 12px",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "8px",
          width: "fit-content",
          zIndex: "99999",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        });

        const label = document.createElement("div");
        label.textContent = "グループID入力";
        Object.assign(label.style, {
          fontSize: "13px",
          color: "#222",
          fontWeight: "500",
        });

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "例: 228";
        input.value = savedId || "";
        Object.assign(input.style, {
          padding: "6px 10px",
          border: "1px solid #bbb",
          borderRadius: "6px",
          fontSize: "14px",
          width: "160px",
          background: "#fff",
          color: "#111",
        });

        // ✅ Notion干渉防止 + ペースト + ⌘A対応
        ["mousedown", "mouseup", "click", "focus"].forEach((ev) => {
          input.addEventListener(ev, (e) => e.stopPropagation());
        });

        input.addEventListener("paste", (e) => {
          e.stopPropagation(); // React伝播防止
        });

        // ⌘A / Ctrl+A で input 全選択
        input.addEventListener("keydown", (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
            e.stopPropagation();
            e.preventDefault();
            input.select();
          }
        });

        input.addEventListener("focus", () => {
          input.style.borderColor = "#2f80ed";
          input.style.boxShadow = "0 0 0 3px rgba(47,128,237,0.12)";
        });
        input.addEventListener("blur", () => {
          input.style.borderColor = "#bbb";
          input.style.boxShadow = "none";
        });

        const button = document.createElement("button");
        button.textContent = "🔗 開く";
        Object.assign(button.style, {
          padding: "6px 10px",
          fontSize: "13px",
          cursor: "pointer",
          border: "1px solid #888",
          borderRadius: "6px",
          background: "#f6f6f6",
          color: "#222",
        });
        ["mousedown", "mouseup", "click"].forEach((ev) => {
          button.addEventListener(ev, (e) => e.stopPropagation());
        });
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const groupId = input.value.trim();
          if (!groupId) return alert("グループIDを入力してください！");
          GM_setValue(courseName, groupId);
          if (!numberOfTimes)
            return alert("回数情報（h1）が見つかりませんでした。");
          const url = `https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/user_groups/${groupId}?number_of_times=${numberOfTimes}`;
          window.open(url, "_blank");
        });

        container.append(label, input, button);
        row.insertAdjacentElement("afterend", container);
      }
    } catch (err) {
      console.error("Notion Link Helper error:", err);
    }
  }, 1200);
})();
