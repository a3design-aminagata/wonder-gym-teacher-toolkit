// ==UserScript==
// @name         LMS : online_lessons - Lesson Intro Template
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  出欠編集ページの注意書き直下に、日付・講師名・ユニットを差し込んだ挨拶テンプレートを表示します。
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*/edit
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	const containerId = "tm-lesson-intro-template";

	if (document.getElementById(containerId)) return;

	const noteParagraph = document.querySelector("p.mx-4.my-2");
	if (!noteParagraph) return;

	const getLessonStartText = () => {
		const box = Array.from(
			document.querySelectorAll("div.w-100.m-4.text-sm"),
		).find(
			(div) =>
				div.querySelector("p.font-bold")?.textContent.trim() === "開始日時",
		);
		return box?.querySelector("p.mx-4")?.textContent.trim() || "";
	};

	const getLecturerName = () => {
		const select = document.querySelector('select[name="lecturer_user_id"]');
		return select?.selectedOptions?.[0]?.textContent.trim() || "(講師未設定)";
	};

	const getUnitTitle = () => {
		const box = Array.from(
			document.querySelectorAll("div.w-100.m-4.text-sm"),
		).find(
			(div) =>
				div.querySelector("p.font-bold")?.textContent.trim() ===
				"学習中のユニット",
		);
		return box?.querySelector("p.mx-4")?.textContent.trim() || "(未入力)";
	};

	const buildDatePhrase = (startText) => {
		if (!startText) return "日付未取得";
		const m = startText.match(/(\d{2})月(\d{2})日.*?(\d{1,2}:\d{2})/);
		if (m) return `${m[1]}月${m[2]}日、${m[3]}`;
		// フォールバック：開始時刻の前までをそのまま使う
		return startText.replace(/\s*~.*$/, "");
	};

	const makeLine = (label, value, suffix, color) => {
		const p = document.createElement("p");
		p.style.margin = "6px 0";
		p.append(document.createTextNode(label));
		const span = document.createElement("span");
		span.textContent = value;
		span.style.color = color;
		span.style.fontWeight = "700";
		p.appendChild(span);
		if (suffix) p.append(document.createTextNode(suffix));
		return p;
	};

	const startText = getLessonStartText();
	const datePhrase = buildDatePhrase(startText);
	const lecturer = getLecturerName();
	const unitTitle = getUnitTitle();

	const wrapper = document.createElement("div");
	wrapper.id = containerId;
	wrapper.style.margin = "12px 16px";
	wrapper.style.padding = "12px 14px";
	wrapper.style.border = "1px solid #cbd5e1";
	wrapper.style.borderRadius = "8px";
	wrapper.style.background = "#f8fafc";
	wrapper.style.lineHeight = "1.6";
	wrapper.style.fontSize = "14px";

	wrapper.appendChild(
		makeLine("講師の", `${lecturer}（フルネーム）です`, "", "#d97706"),
	);
	wrapper.appendChild(
		makeLine("本日は", `${datePhrase}の授業です`, "", "#2563eb"),
	);
	wrapper.appendChild(
		makeLine("本日の内容は", `${unitTitle}です`, "", "#0ea5e9"),
	);
	wrapper.appendChild(makeLine("", "出席確認します", "", "#16a34a"));

	noteParagraph.insertAdjacentElement("afterend", wrapper);
})();
