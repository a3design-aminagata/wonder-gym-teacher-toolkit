// ==UserScript==
// @name         LMS : online_lessons - data fields
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  テーブルヘッダから data-field を付与
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	const tables = document.querySelectorAll("table.text-center.block");
	let hasApplied = false;

	tables.forEach((table) => {
		if (table.dataset.dataFieldDone) return;
		table.dataset.dataFieldDone = "true";
		hasApplied = true;

		const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
			th.textContent.replace(/\s+/g, ""),
		);

		const rows = table.querySelectorAll("tbody tr");

		rows.forEach((tr) => {
			const tds = Array.from(tr.children);

			headers.forEach((h, i) => {
				if (!tds[i]) return;

				if (h.includes("受講生")) tds[i].dataset.field = "student";
				if (h.includes("フリガナ")) tds[i].dataset.field = "kana";
				if (h.includes("出欠")) tds[i].dataset.field = "attendance";
				if (h.includes("モチベ")) tds[i].dataset.field = "motivation";
				if (h.includes("進行")) tds[i].dataset.field = "progress";
				if (h.includes("一言コメント")) tds[i].dataset.field = "comment";
			});

			// ▼おまけ提案：最初の列（共有コメント等）にも後でデータを抜き出しやすくするために付与しておくのもアリです
			const firstTd = tr.firstElementChild;
			if (firstTd && !firstTd.dataset.field) {
				firstTd.dataset.field = "shared_comment";
			}
		});
	});

	// ▼ 追加：処理が完了したら、他のスクリプトに向けて「準備完了」の合図を出す
	if (hasApplied || tables.length > 0) {
		document.body.dataset.fieldsReady = "true"; // 完了フラグ
		document.dispatchEvent(new CustomEvent("DataFieldsReady")); // 合図を発信
	}
})();
