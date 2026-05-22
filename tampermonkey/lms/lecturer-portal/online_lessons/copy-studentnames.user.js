// ==UserScript==
// @name         LMS : online_lessons - 生徒名一括コピー
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  online_lessons編集画面で参加受講生を一括コピー
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	const SHORTCUT_PROFILE_NAME = "Default";
	const CHATGPT_THREAD_URL =
		"https://chatgpt.com/g/g-p-69afaaa707688191a0f82ba5ec9aa7db/c/69afaad0-30d4-8322-9199-a0d6800554f1";

	// ▼ データ付与スクリプト(Base)の完了を待機する
	if (document.body.dataset.fieldsReady) {
		init(); // すでに完了していればすぐ実行
	} else {
		document.addEventListener("DataFieldsReady", init); // 完了の合図を待つ
	}

	function init() {
		const header = findHeader();
		if (!header) return;

		if (document.querySelector("#_copyAllStudentsBtn")) return;

		const btn = createButton();
		header.insertAdjacentElement("afterend", btn);
	}

	function findHeader() {
		const headers = Array.from(document.querySelectorAll("h2"));
		return headers.find((h) => h.textContent.includes("参加受講生"));
	}

	function createButton() {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.id = "_copyAllStudentsBtn";
		btn.textContent = "参加受講生を全員コピー";

		Object.assign(btn.style, {
			margin: "14px",
			padding: "8px 18px",
			fontSize: "14px",
			background: "#6366f1",
			color: "#fff",
			border: "none",
			borderRadius: "9999px",
			cursor: "pointer",
		});

		btn.addEventListener("click", async (e) => {
			e.preventDefault(); // 念のため
			e.stopPropagation(); // さらに安全

			const text = collectNames();
			if (!text) return;

			try {
				await navigator.clipboard.writeText(text);
			} catch (err) {
				console.error("Failed to copy student names:", err);
				alert("クリップボードにコピーできませんでした");
				return;
			}

			btn.textContent = "コピー完了！";
			btn.style.background = "#16a34a";

			openInDefaultProfile(CHATGPT_THREAD_URL, text);

			setTimeout(() => {
				btn.textContent = "参加受講生を全員コピー";
				btn.style.background = "#2563eb";
			}, 1500);
		});

		return btn;
	}

	function collectNames() {
		const rows = document.querySelectorAll("table.text-center.block tbody tr");
		const results = [];

		rows.forEach((tr) => {
			// 既存attendancesのみ対象（new_attendances除外）
			const studentCell = tr.querySelector('[data-field="student"]');
			const kanaCell = tr.querySelector('[data-field="kana"]');

			if (!studentCell || !kanaCell) return;

			// select形式（新規行）は除外
			if (studentCell.querySelector("select")) return;

			const name = studentCell.childNodes[0]?.textContent.trim();
			const kana = kanaCell.textContent.trim();

			if (name && kana) {
				results.push(`${name}　${kana}`);
			}
		});

		return results.join("\n");
	}

	function runShortcutWithUrl(name, urlToOpen) {
		const encodedName = encodeURIComponent(name);
		const encodedUrl = encodeURIComponent(urlToOpen);
		location.href = `shortcuts://run-shortcut?name=${encodedName}&input=text&text=${encodedUrl}`;
	}

	async function openInDefaultProfile(url, textToCopy) {
		try {
			if (textToCopy) {
				await navigator.clipboard.writeText(textToCopy);
			}
			runShortcutWithUrl(SHORTCUT_PROFILE_NAME, url);
		} catch (err) {
			console.error("Failed to launch shortcut:", err);
		}
	}
})();
