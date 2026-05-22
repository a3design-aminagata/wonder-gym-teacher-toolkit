// ==UserScript==
// @name         LMS : user-groups - 02. Layout
// @namespace    https://github.com/a3design-aminagata/
// @version      3.0
// @description  DOMは固定・レイアウトはCSSのみで切替
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/user_groups/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	if (document.body.dataset.userGroupsReady) {
		init();
	} else {
		document.addEventListener("UserGroupsDataReady", init);
	}

	function init() {
		injectStyles();
		convertTableStructure();
	}

	function injectStyles() {
		if (document.getElementById("_lmsMobileStyle")) return;

		const style = document.createElement("style");
		style.id = "_lmsMobileStyle";
		style.textContent = `
/* --- 基本構造 --- */
.mt-10{ margin-left: 20px; margin-right: 20px; }
table.text-center.block thead { display: none; }
table.text-center.block tbody { display: block; }
table.text-center.block tbody tr {
    display: flex;
    border-bottom: 1px solid #ddd;
    padding: 0.5rem;
    align-items: center;
}
tr.has-action:not(:first-of-type) { margin-top: 0.1rem; }
tr.no-action{ border-top: none; }
table.text-center.block tbody td {
    display: block;
    text-align: left;
    padding: 0;
    word-break: break-word;
    white-space: normal;
}
._nameGroup { width: 100px; flex : 0 0 auto; }

/* --- グループ --- */
._nameGroup, ._statusGroup { display: flex; gap: 6px; }
._mainRow { display: flex; gap: 20px; width: 100%; align-items: flex-start; }
tbody tr.group-even { background: #e5ecf0; }
tbody tr.group-odd { background: none; }
tbody tr.bg-blue-300 { background-color: #a4cafe; }

/* ▼ クラスの代わりに data-field を使って幅を指定 */
td[data-field="datetime"] { width: 120px; }

/* --- レスポンシブ制御 --- */
@media (max-width: 1100px) {
    td[data-field="url"] { flex: 1; }
    ._nameGroup, ._statusGroup { flex-direction: column; }
    ._statusGroup { flex: 0 0 auto; width: 50px; flex-direction: row; }
    ._mainRow { flex-direction: row; padding-left: 15px; align-items: center; }
    td[data-field="datetime"], td[data-field="teacher"], td[data-field="url"] { padding: 4px 0; }
    table.text-center.block tbody tr { flex-direction: row; flex-wrap: wrap; gap: 10px; }
}

@media (min-width: 1101px) {
    .ml-16 { margin: 20px; }
    ._nameGroup, ._statusGroup { flex-direction: row; }
    ._nameGroup { flex-direction: column; }
    table.text-center.block tbody ._mainRow { flex-direction: row; flex : 1; }
    table.text-center.block tbody tr { display: flex; flex-direction: row; flex-wrap: nowrap; }

    td[data-field="action"] { width: 130px; }
    td[data-field="transfer"] { width: 10px; margin-right: 10px; }
    td[data-field="count"] { width: 20px; margin-right: 10px; }
    td[data-field="datetime"] { margin-right: 10px; }
    td[data-field="teacher"] { width: 70px; margin-right: 10px; }
    td[data-field="url"] { width: 110px; margin-right: 10px; }
    ._statusGroup td { width: 10px; }

    ._mainRow > ._nameGroup, ._mainRow > ._statusGroup { flex: 0 0 auto; }
    ._mainRow > td { flex: 1 1 0; min-width: 0; }
}
`;
		document.head.appendChild(style);
	}

	function convertTableStructure() {
		const tables = document.querySelectorAll("table.text-center.block");
		let groupIndex = -1; // 全テーブル通して偶奇を判定する用

		tables.forEach((table) => {
			if (table.dataset.layoutEnhanced) return;
			table.dataset.layoutEnhanced = "true";

			const rows = Array.from(table.querySelectorAll("tbody tr"));

			rows.forEach((tr) => {
				const actionCell = tr.querySelector('td[data-field="action"]');

				// has-actionの判定と偶奇クラス付与
				if (actionCell) {
					const hasContent =
						actionCell.textContent.trim() !== "" ||
						actionCell.querySelector("a, button, input, select");

					if (hasContent) {
						tr.classList.add("has-action");
						tr.classList.remove("no-action");
						groupIndex++;
					} else {
						tr.classList.add("no-action");
						tr.classList.remove("has-action");
					}

					if (groupIndex >= 0) {
						if (groupIndex % 2 === 0) {
							tr.classList.add("group-even");
							tr.classList.remove("group-odd");
						} else {
							tr.classList.add("group-odd");
							tr.classList.remove("group-even");
						}
					}
				}

				// DOMのラップ処理（Baseが付けた data-field を利用）
				const nameTd = tr.querySelector('td[data-field="student"]');
				const kanaTd = tr.querySelector('td[data-field="kana"]');
				const attendanceTd = tr.querySelector('td[data-field="attendance"]');
				const motivationTd = tr.querySelector('td[data-field="motivation"]');
				const progressTd = tr.querySelector('td[data-field="progress"]');
				const commentTd = tr.querySelector('td[data-field="comment"]');

				let nameGroup = null;
				if (nameTd && kanaTd) {
					nameGroup = document.createElement("div");
					nameGroup.className = "_nameGroup";
					tr.insertBefore(nameGroup, nameTd);
					nameGroup.appendChild(nameTd);
					nameGroup.appendChild(kanaTd);
				}

				let statusGroup = null;
				if (attendanceTd && motivationTd && progressTd) {
					statusGroup = document.createElement("div");
					statusGroup.className = "_statusGroup";
					tr.insertBefore(statusGroup, attendanceTd);
					statusGroup.appendChild(attendanceTd);
					statusGroup.appendChild(motivationTd);
					statusGroup.appendChild(progressTd);
				}

				if (nameGroup && statusGroup) {
					const mainWrapper = document.createElement("div");
					mainWrapper.className = "_mainRow";
					tr.insertBefore(mainWrapper, nameGroup);
					mainWrapper.appendChild(nameGroup);
					mainWrapper.appendChild(statusGroup);
					if (commentTd) mainWrapper.appendChild(commentTd);
				}
			});
		});
	}
})();
