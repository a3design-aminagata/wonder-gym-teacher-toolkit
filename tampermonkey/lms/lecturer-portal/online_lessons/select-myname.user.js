// ==UserScript==
// @name         LMS : online_lessons - Auto Select My Name + Status Notice
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  既存選択を通知してからログインユーザーを自動選択
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	// ===== ログインユーザー名取得 =====
	const nameButton = Array.from(document.querySelectorAll("button")).find((b) =>
		b.textContent.includes(" さん"),
	);
	if (!nameButton) return;

	const fullText = nameButton.textContent.trim();
	const nameMatch = fullText.match(/(.+?) さん/);
	if (!nameMatch) return;

	const userName = nameMatch[1].trim();
	console.log("Detected user name:", userName);

	// ===== セレクト取得 =====
	const select = document.querySelector('select[name="lecturer_user_id"]');
	if (!select) return;

	const options = Array.from(select.options);

	// ===== 事前選択状態を取得 =====
	const previouslySelectedOption = select.options[select.selectedIndex];
	const previouslySelectedText = previouslySelectedOption?.text?.trim();

	let noticeMessage = "";

	if (!previouslySelectedText || previouslySelectedOption.value === "") {
		noticeMessage = "⚠️ 未記入でした";
	} else if (!previouslySelectedText.includes(userName)) {
		noticeMessage = `⚠️ 「${previouslySelectedText}」さんが選ばれていました`;
	}

	// ===== 通知表示 =====
	if (noticeMessage) {
		const notice = document.createElement("div");
		notice.textContent = noticeMessage;

		notice.style.background = "#fff3cd";
		notice.style.border = "1px solid #ffeeba";
		notice.style.color = "#856404";
		notice.style.padding = "8px 12px";
		notice.style.marginBottom = "8px";
		notice.style.borderRadius = "6px";
		notice.style.fontWeight = "bold";

		select.parentNode.insertBefore(notice, select);
	}

	// ===== 自分の名前を先頭へ =====
	const target = options.find((o) => o.text.includes(userName));
	if (target) {
		select.insertBefore(target, select.firstChild);
		select.value = target.value;
	}
})();
