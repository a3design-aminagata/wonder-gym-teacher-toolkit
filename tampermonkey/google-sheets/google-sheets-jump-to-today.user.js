// ==UserScript==
// @name         Google Sheets - 今日のセルへ移動（検索窓強制閉鎖版）
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  Google Sheets で今日の日付セルへ検索ジャンプし、検索バーを確実に閉じる
// @match        https://docs.google.com/spreadsheets/d/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	function jump() {
		const today = new Date();
		const searchStr = `${today.getMonth() + 1}/${today.getDate()}(`;

		// 1. 検索窓を起動（Cmd+F / Ctrl+F）
		const isMac = navigator.platform.toUpperCase().includes("MAC");
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

				// 2. 日付を入力
				input.value = searchStr;
				input.dispatchEvent(new Event("input", { bubbles: true }));
				input.focus();

				// 3. Enterでジャンプ実行
				setTimeout(() => {
					input.dispatchEvent(
						new KeyboardEvent("keydown", { keyCode: 13, bubbles: true }),
					);

					// 4. 検索窓を確実に閉じる
					setTimeout(() => {
						// 方法A: Escキー送信
						input.dispatchEvent(
							new KeyboardEvent("keydown", { keyCode: 27, bubbles: true }),
						);

						// 方法B: 「×」ボタンをクリック
						const closeBtn = document.querySelector(".docs-findinput-close");
						if (closeBtn) {
							closeBtn.dispatchEvent(
								new MouseEvent("mousedown", { bubbles: true }),
							);
							closeBtn.dispatchEvent(
								new MouseEvent("mouseup", { bubbles: true }),
							);
							closeBtn.click();
						}

						// 方法C: スタイルで強制的に非表示
						const findBar = document.querySelector(".docs-findinput");
						if (findBar) {
							findBar.style.display = "none";
						}

						// シート本体にフォーカスを戻す
						const grid =
							document.querySelector(".grid-container") ||
							document.activeElement;
						if (grid) grid.focus();
					}, 100); // 移動完了を少し待つ
				}, 150);
			} else if (attempts > 40) {
				clearInterval(checkInput);
			}
		}, 50);
	}

	function injectButton() {
		if (document.getElementById("jump-to-today-btn")) return;

		const btn = document.createElement("button");
		btn.id = "jump-to-today-btn";
		btn.textContent = "📅 ";

		Object.assign(btn.style, {
			position: "fixed",
			top: "10px",
			right: "370px",
			zIndex: "9999",
			padding: "12px 20px",
			backgroundColor: "#1a73e8",
			color: "white",
			border: "none",
			borderRadius: "8px",
			cursor: "pointer",
			fontWeight: "bold",
			boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
		});

		btn.onclick = jump;
		document.body.appendChild(btn);
	}

	setInterval(injectButton, 300);
})();
