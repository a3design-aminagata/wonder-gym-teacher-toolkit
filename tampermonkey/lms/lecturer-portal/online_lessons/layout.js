// ==UserScript==
// @name         LMS : online_lessons - layout
// @namespace    https://github.com/a3design-aminagata/
// @version      1.2
// @description  data-field を利用したレスポンシブレイアウト
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	// ▼ ①のデータ付与が完了しているか確認
	if (document.body.dataset.fieldsReady) {
		init(); // すでに終わっていればすぐ実行
	} else {
		// まだ終わっていなければ、合図が来るのを待つ
		document.addEventListener("DataFieldsReady", init);
	}

	function init() {
		injectStyles();
		convertStructureOnce();
	}

	function injectStyles() {
		if (document.getElementById("_onlineLessonStyle")) return;
		const style = document.createElement("style");
		style.id = "_onlineLessonStyle";

		style.textContent = `
table.text-center.block thead { display:none; }
table.text-center.block tbody { display:block; }

table.text-center.block tbody tr {
	display:flex;
	flex-direction:row;
	border-bottom:1px solid #ddd;
	padding:12px;
}

table.text-center.block tbody td {
	text-align:left;
	word-break:break-word;
}

/* 最初の列の幅を統一 */
._firstCol {
	width: 230px;
	min-width: 230px;
	flex: 0 0 230px;
	box-sizing: border-box;
}

._mainRow {
	display:flex;
	gap:16px;
	width:100%;
	align-items:flex-start;
}

._nameGroup {
	display:flex;
	flex-direction:column-reverse;
	gap:4px;
	width:200px;
}

._statusGroup {
	display:flex;
	gap:8px;
	flex-wrap:wrap;
	flex-direction:column;
}

._statusGroup > td { padding:0; }

._statusGroup select {
	width:90px;
	padding:10px;
}

@media (min-width:1101px){
	table.text-center.block thead{ display:table-header-group; }
	table.text-center.block tbody{ display:table-row-group; }
	table.text-center.block tbody tr{ display:table-row; }
	table.text-center.block tbody td{ display:table-cell; }

	._mainRow { align-items:center; }
	._nameGroup{ align-items:flex-start; flex-direction:row; }
	._statusGroup{ flex-wrap:nowrap; flex-direction:row; }
}
`;
		document.head.appendChild(style);
	}

	function convertStructureOnce() {
		const tables = document.querySelectorAll("table.text-center.block");

		tables.forEach((table) => {
			if (table.dataset.layoutDone) return;
			table.dataset.layoutDone = "true";

			const rows = table.querySelectorAll("tbody tr");

			rows.forEach((tr) => {
				// クラス付与はレイアウト側で行う（正解）
				const firstTd = tr.firstElementChild;
				if (firstTd && firstTd.tagName === "TD") {
					firstTd.classList.add("_firstCol");
				}

				const student = tr.querySelector('[data-field="student"]');
				const kana = tr.querySelector('[data-field="kana"]');
				const attendance = tr.querySelector('[data-field="attendance"]');
				const motivation = tr.querySelector('[data-field="motivation"]');
				const progress = tr.querySelector('[data-field="progress"]');
				const comment = tr.querySelector('[data-field="comment"]');

				if (!student || !kana) return;

				const main = document.createElement("div");
				main.className = "_mainRow";
				const nameGroup = document.createElement("div");
				nameGroup.className = "_nameGroup";
				const statusGroup = document.createElement("div");
				statusGroup.className = "_statusGroup";

				tr.insertBefore(main, student);
				nameGroup.appendChild(student);
				nameGroup.appendChild(kana);

				if (attendance) statusGroup.appendChild(attendance);
				if (motivation) statusGroup.appendChild(motivation);
				if (progress) statusGroup.appendChild(progress);

				main.appendChild(nameGroup);
				main.appendChild(statusGroup);
				if (comment) main.appendChild(comment);
			});
		});
	}
})();
