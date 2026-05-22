// ==UserScript==
// @name         LMS : user-groups - 01. Base (データ付与)
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  全スクリプトの土台。テーブルセルに data-field を付与
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/user_groups/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	const tables = document.querySelectorAll("table.text-center.block");
	let hasApplied = false;

	tables.forEach((table) => {
		if (table.dataset.baseEnhanced) return;
		table.dataset.baseEnhanced = "true";
		hasApplied = true;

		const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
			th.textContent.trim(),
		);

		const rows = table.querySelectorAll("tbody tr");

		rows.forEach((tr) => {
			const tds = Array.from(tr.children);

			headers.forEach((h, i) => {
				const td = tds[i];
				if (!td) return;

				// 共通の data-field を付与（クラスの代わりにもなる）
				if (h === "") td.dataset.field = "action";
				else if (h.includes("振替授業")) td.dataset.field = "transfer";
				else if (h.includes("実施回数")) td.dataset.field = "count";
				else if (h.includes("日時")) td.dataset.field = "datetime";
				else if (h.includes("講師名")) td.dataset.field = "teacher";
				else if (h.includes("授業URL")) td.dataset.field = "url";
				else if (h.includes("受講生")) td.dataset.field = "student";
				else if (h.includes("フリガナ")) td.dataset.field = "kana";
				else if (h.includes("出欠")) td.dataset.field = "attendance";
				else if (h.includes("モチベ")) td.dataset.field = "motivation";
				else if (h.includes("進行")) td.dataset.field = "progress";
				else if (h.includes("一言コメント")) td.dataset.field = "comment";
			});
		});
	});

	if (hasApplied || tables.length > 0) {
		document.body.dataset.userGroupsReady = "true";
		document.dispatchEvent(new CustomEvent("UserGroupsDataReady"));
	}
})();
