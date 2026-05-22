// ==UserScript==
// @name         LMS : Common UI Enhancements
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  LMS共通UI改善（textarea自動伸縮など）
// @match        https://wonder-gym.jp/lecturer-portal/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	function enableAutoResizeTextareas(root = document) {
		const textareas = root.querySelectorAll("textarea");

		textareas.forEach((el) => {
			if (el.dataset.autoResizeAttached) return;
			el.dataset.autoResizeAttached = "true";

			el.style.overflow = "hidden";
			el.style.resize = "none";

			const autoResize = () => {
				el.style.height = "auto";
				const newHeight = el.scrollHeight;

				// 異常値ガード
				if (newHeight > 0 && newHeight < 1000) {
					el.style.height = newHeight + "px";
				}
			};

			requestAnimationFrame(autoResize);
			el.addEventListener("input", autoResize);
		});
	}

	// 初期実行
	enableAutoResizeTextareas();

	// SPAやAjax対策（後から追加されるtextarea対応）
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				enableAutoResizeTextareas();
				break;
			}
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
})();
