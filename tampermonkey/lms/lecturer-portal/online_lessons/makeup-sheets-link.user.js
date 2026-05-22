// ==UserScript==
// @name         LMS : online_lessons - MakeUpClass Sheets Link
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  振替授業のときだけGoogle Sheetsリンクを表示
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*
// @grant        none
// ==/UserScript==

(function () {
	"use strict";
	// 共有用: 実運用では自分のスプレッドシートURLに差し替えてください。
	const MAKEUP_SHEET_URL =
		"https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit";

	function addSheetsLink() {
		const makeUpInput = document.querySelector(
			'input[name="is_make_up_class"][value="1"]',
		);
		if (!makeUpInput) return;

		const submitButton = document.querySelector(
			'input[type="submit"][value="参加受講生を更新する"]',
		);
		if (!submitButton) return;

		if (document.querySelector(".custom-sheets-link")) return;

		// ボタンの高さ取得
		const buttonHeight = submitButton.offsetHeight;

		const link = document.createElement("a");
		link.href = MAKEUP_SHEET_URL;
		link.target = "_blank";
		link.className = "custom-sheets-link";
		link.title = "Google Sheetsで開く";

		// 横並び用スタイル
		link.style.display = "inline-flex";
		link.style.alignItems = "center";
		link.style.marginLeft = "8px";
		link.style.height = buttonHeight + "px";

		link.innerHTML = `
            <svg viewBox="0 0 24 24" style="height:${buttonHeight * 0.8}px; width:auto;" aria-hidden="true">
                <rect x="3" y="2" width="20" height="20" rx="2" fill="#1FA463"></rect>
                <rect x="10" y="4" width="2" height="16" fill="#ffffff"></rect>
                <rect x="4" y="10" width="16" height="2" fill="#ffffff"></rect>
            </svg>
        `;

		submitButton.insertAdjacentElement("afterend", link);
	}

	addSheetsLink();

	const observer = new MutationObserver(addSheetsLink);
	observer.observe(document.body, { childList: true, subtree: true });
})();
