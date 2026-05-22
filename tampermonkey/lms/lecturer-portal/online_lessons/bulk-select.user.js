// ==UserScript==
// @name         LMS : online_lessons - Bulk Select
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  生徒が存在する行のみ「良い」&「参加」を自動選択
// @match        https://wonder-gym.jp/*/edit
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	// --- ボタン作成 ---
	const btn = document.createElement("button");
	btn.textContent = "全員：良い／参加を選択";
	btn.style.position = "fixed";
	btn.style.top = "85px";
	btn.style.right = "20px";
	btn.style.zIndex = "30";
	btn.style.padding = "10px 16px";
	btn.style.background = "#6366f1";
	btn.style.color = "white";
	btn.style.border = "none";
	btn.style.borderRadius = "6px";
	btn.style.cursor = "pointer";
	btn.style.fontSize = "14px";
	btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
	document.body.appendChild(btn);

	// --- ボタン押下 ---
	btn.addEventListener("click", () => {
		// 既存生徒のみ（new_attendancesを除外）
		const selects = document.querySelectorAll('select[name^="attendances["]');

		let count = 0;

		selects.forEach((select) => {
			const options = Array.from(select.options);

			const goodOption = options.find((opt) => opt.text.trim() === "良い");

			const attendOption = options.find((opt) => opt.text.includes("参加"));

			if (goodOption) {
				select.value = goodOption.value;
				count++;
			} else if (attendOption) {
				select.value = attendOption.value;
				count++;
			}

			const event = new Event("change", { bubbles: true });
			select.dispatchEvent(event);
		});

		console.log(`Bulk Select: ${count}件処理`);
	});

	console.log("[Tampermonkey] 出欠自動選択ボタンを追加しました");
})();
