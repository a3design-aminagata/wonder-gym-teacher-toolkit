// ==UserScript==
// @name         LMS : user-groups - 03. 生徒名コピー
// @namespace    https://github.com/a3design-aminagata/
// @version      7.0
// @description  Baseのdata-fieldに依存した安定版
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/user_groups/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	if (document.body.dataset.userGroupsReady) {
		initCopy();
	} else {
		document.addEventListener("UserGroupsDataReady", initCopy);
	}

	function initCopy() {
		const tables = document.querySelectorAll("table.text-center.block");

		tables.forEach((table) => {
			if (table.dataset.copyEnhanced) return;
			table.dataset.copyEnhanced = "true";

			const rows = Array.from(table.querySelectorAll("tbody tr"));

			rows.forEach((tr, index) => {
				if (!isActionRow(tr)) return;

				const actionCell = tr.querySelector('td[data-field="action"]');
				if (!actionCell) return;

				if (actionCell.querySelector("._copyBtn")) return;

				const attendanceBtn = actionCell.querySelector(
					"a.admin-indigo-button-round",
				);
				if (!attendanceBtn) return;

				const copyBtn = document.createElement("button");
				copyBtn.textContent = "生徒名をコピー";
				copyBtn.className = "_copyBtn";

				styleCopyButton(copyBtn);

				copyBtn.addEventListener("click", () => {
					const names = collectGroupNames(rows, index);
					if (!names) return;

					navigator.clipboard.writeText(names);

					copyBtn.textContent = "コピー完了！";
					copyBtn.style.background = "#16a34a";

					setTimeout(() => {
						copyBtn.textContent = "生徒名をコピー";
						copyBtn.style.background = "#2563eb";
					}, 1500);
				});

				// UI整形
				actionCell.style.display = "flex";
				actionCell.style.flexDirection = "column";
				actionCell.style.alignItems = "baseline";

				attendanceBtn.insertAdjacentElement("afterend", copyBtn);
			});
		});
	}

	function isActionRow(tr) {
		const actionCell = tr.querySelector('td[data-field="action"]');
		if (!actionCell) return false;
		return !!actionCell.querySelector("a.admin-indigo-button-round");
	}

	function collectGroupNames(rows, startIndex) {
		const names = [];

		for (let i = startIndex; i < rows.length; i++) {
			const tr = rows[i];

			if (i !== startIndex && isActionRow(tr)) {
				break;
			}

			const student = tr.querySelector('td[data-field="student"]');
			const kana = tr.querySelector('td[data-field="kana"]');

			if (!student || !kana) continue;

			const name = student.textContent.trim();
			const kanaText = kana.textContent.trim();

			if (name && kanaText) {
				names.push(`${name}　${kanaText}`);
			}
		}

		return names.join("\n");
	}

	function styleCopyButton(btn) {
		Object.assign(btn.style, {
			marginTop: "6px",
			padding: "6px 16px",
			fontSize: "13px",
			background: "#2563eb",
			color: "#fff",
			border: "none",
			borderRadius: "9999px",
			cursor: "pointer",
		});
	}
})();
