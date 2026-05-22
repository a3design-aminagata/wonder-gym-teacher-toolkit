// ==UserScript==
// @name         Google Sheets - 自分の名前へジャンプ
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  スプレッドシート内で自分の名前を素早く検索してジャンプするボタンを追加
// @match        https://docs.google.com/spreadsheets/d/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	const STORAGE_KEY = "jumpToMyName.target";
	const BTN_ID = "jump-to-my-name-btn";

	const isMac = navigator.platform.toUpperCase().includes("MAC");

	function getTargetName() {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && stored.trim()) return stored.trim();

		const input = prompt("検索したい自分の名前を入力してください", stored || "");
		if (!input) return "";
		const trimmed = input.trim();
		localStorage.setItem(STORAGE_KEY, trimmed);
		return trimmed;
	}

	function closeFindBar(input) {
		// 方法A: Esc
		input.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27, bubbles: true }));

		// 方法B: 「×」ボタン
		const closeBtn = document.querySelector(".docs-findinput-close");
		if (closeBtn) {
			closeBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
			closeBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
			closeBtn.click();
		}

		// 方法C: スタイルで非表示
		const findBar = document.querySelector(".docs-findinput");
		if (findBar) findBar.style.display = "none";

		// シート本体へフォーカスを戻す
		const grid = document.querySelector(".grid-container") || document.activeElement;
		if (grid) grid.focus();
	}

	function jumpToName() {
		const target = getTargetName();
		if (!target) return;

		// Cmd/Ctrl + F で検索窓を開く
		document.body.dispatchEvent(
			new KeyboardEvent("keydown", {
				keyCode: 70,
				ctrlKey: !isMac,
				metaKey: isMac,
				bubbles: true,
			}),
		);

		let attempts = 0;
		const checkInput = setInterval(() => {
			const input = document.querySelector(".docs-findinput-input");
			attempts++;

			if (input) {
				clearInterval(checkInput);

				input.value = target;
				input.dispatchEvent(new Event("input", { bubbles: true }));
				input.focus();

				setTimeout(() => {
					// Enter で検索＆ジャンプ
					input.dispatchEvent(
						new KeyboardEvent("keydown", { keyCode: 13, bubbles: true }),
					);

					// すこし待って検索バーを閉じる
					setTimeout(() => closeFindBar(input), 120);
				}, 120);
			} else if (attempts > 40) {
				clearInterval(checkInput);
			}
		}, 50);
	}

	function injectButton() {
		if (document.getElementById(BTN_ID)) return;

		const btn = document.createElement("button");
		btn.id = BTN_ID;
		btn.textContent = "🙋‍♀️ 名前へ";
		btn.title = "自分の名前を検索してジャンプ (クリックで実行)";

		Object.assign(btn.style, {
			position: "fixed",
			top: "10px",
			right: "270px", // 既存の今日ボタンより少し左
			zIndex: "9999",
			padding: "12px 18px",
			backgroundColor: "#d93025",
			color: "white",
			border: "none",
			borderRadius: "8px",
			cursor: "pointer",
			fontWeight: "bold",
			boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
		});

		btn.onclick = () => {
			jumpToName();
			// ボタンラベルに現在の名前をうっすら表示
			const current = localStorage.getItem(STORAGE_KEY);
			if (current) btn.textContent = `🙋‍♀️ ${current}`;
		};

		document.body.appendChild(btn);

		// 初期表示も名前を反映
		const current = localStorage.getItem(STORAGE_KEY);
		if (current) btn.textContent = `🙋‍♀️ ${current}`;
	}

	setInterval(injectButton, 300);
})();
