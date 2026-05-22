// ==UserScript==
// @name         LMS : online_lessons - Buttons
// @namespace    https://github.com/a3design-aminagata/
// @version      1.4
// @description  出欠編集ページで「参加」「不参加」「遅刻」ボタンを追加。振替授業の不参加時はLMSの入力をクリアします。
// @match        https://wonder-gym.jp/*/edit
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	const isMakeUpClass = Boolean(
		document.querySelector('input[name="is_make_up_class"][value="1"]'),
	);

	const init = () => {
		const attendanceSelects = document.querySelectorAll(
			'select[name^="attendances"][name$="[is_attended]"]',
		);

		if (attendanceSelects.length === 0) return;

		attendanceSelects.forEach((select) => {
			if (select.closest("tr").querySelector(".tm-added-btn")) return;

			const match = select.name.match(/attendances\[(\d+)\]\[is_attended\]/);
			if (!match) return;
			const id = match[1];
			const tr = select.closest("tr");

			const nameTd =
				tr.querySelector('td[data-field="student"]') ||
				tr.querySelector("td:nth-child(2)");
			if (!nameTd) return;

			const makeBtn = (label, color) => {
				const btn = document.createElement("button");
				btn.className = "tm-added-btn";
				btn.textContent = label;
				btn.style = `display:block; margin-top:4px; padding:4px 8px; background:${color}; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer; width:100%; max-width:500px;`;
				return btn;
			};

			// --- 共通：意欲と進捗をセットする関数 ---
			const setLevels = (val) => {
				["motivation_level", "progress_level"].forEach((field) => {
					const s = document.querySelector(
						`select[name="attendances[${id}][${field}]"]`,
					);
					if (s) {
						if (val === "") {
							s.value = ""; // 空にする
						} else {
							const opt = Array.from(s.options).find(
								(o) => o.text.includes(val) && !o.text.includes("大変"),
							);
							if (opt) s.value = opt.value;
						}
						s.dispatchEvent(new Event("change", { bubbles: true }));
					}
				});
			};

			// --- 参加ボタン ---
			const presentBtn = makeBtn("参加を選択", "#22c55e");
			presentBtn.addEventListener("click", (e) => {
				e.preventDefault();
				tr.setAttribute("data-attendance-status", "present");
				const option = Array.from(select.options).find((o) =>
					o.text.includes("参加"),
				);
				if (option) select.value = option.value;
				setLevels("良い");
				select.dispatchEvent(new Event("change", { bubbles: true }));
			});

			// --- 遅刻・再入室ボタン ---
			const lateBtn = makeBtn("遅刻・再入室として報告", "#f59e0b");
			lateBtn.addEventListener("click", (e) => {
				e.preventDefault();
				tr.setAttribute("data-attendance-status", "late");
				const option = Array.from(select.options).find((o) =>
					o.text.includes("参加"),
				);
				if (option) select.value = option.value;
				setLevels("良い");
				select.dispatchEvent(new Event("change", { bubbles: true }));
			});

			// --- 不参加ボタン ---
			const absentBtnLabel = isMakeUpClass
				? "不参加 (Slack報告のみ)"
				: "不参加を選択";
			const absentBtn = makeBtn(absentBtnLabel, "#ef4444");
			absentBtn.addEventListener("click", (e) => {
				e.preventDefault();
				tr.setAttribute("data-attendance-status", "absent");

				if (isMakeUpClass) {
					// 【振替授業の場合】出欠・意欲・進捗をすべて「空(未選択)」にする
					select.value = "";
					setLevels("");
					console.log(
						"[TM] 振替授業のためLMS入力をクリアしました（Slack報告のみ保持）",
					);
				} else {
					// 【通常授業の場合】不参加をセットし、意欲・進捗を空にする
					const option = Array.from(select.options).find((o) =>
						o.text.includes("不参加"),
					);
					if (option) select.value = option.value;
					setLevels("");
				}
				select.dispatchEvent(new Event("change", { bubbles: true }));
			});

			nameTd.appendChild(presentBtn);
			nameTd.appendChild(lateBtn);
			nameTd.appendChild(absentBtn);
		});
	};

	init();
	setTimeout(init, 1000);
})();
