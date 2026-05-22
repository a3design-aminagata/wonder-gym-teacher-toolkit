// ==UserScript==
// @name         LMS : Common - Title Formatter
// @namespace    https://github.com/a3design-aminagata/
// @version      1.2
// @description  タイトルに講座情報＋開始時刻を追加（ラベル基準）
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/*
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	const url = location.pathname;

	// ===== ベースタイトル取得 =====
	let textEl =
		document.querySelector("div.my-4.text-center.text-2xl.font-bold") ||
		document.querySelector("p.mx-4");

	if (!textEl) return;

	let titleText = textEl.textContent.trim();
	titleText = titleText.replace(/開講（.*?）/g, "").trim();

	// ★ 年を削除（2025年 → 削除）
	titleText = titleText.replace(/\d{4}年\s*/g, "");

	// ===== editページだけ処理 =====
	if (/\/online_lessons\/\d+\/edit$/.test(url)) {
		const labels = document.querySelectorAll("p.font-bold");

		labels.forEach((label) => {
			if (label.textContent.includes("開始日時")) {
				const valueP = label.nextElementSibling;

				if (valueP) {
					const dateText = valueP.textContent;

					const match = dateText.match(/(\d{2}:\d{2})\s*~/);

					if (match) {
						const startTime = match[1];
						titleText += ` | ${startTime}`;
					}
				}
			}
		});
	}

	document.title = titleText;
})();
