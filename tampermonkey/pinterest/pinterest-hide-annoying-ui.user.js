// ==UserScript==
// @name         Pinterest : 不要UI非表示
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  Pinterestのネット未接続バナー＋上部タブを消す
// @match        https://jp.pinterest.com/*
// @match        https://www.pinterest.com/*
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	const TARGET_TEXT = "インターネットに接続されていません";

	const removeBanner = () => {
		document.querySelectorAll("span").forEach((span) => {
			if (span.textContent.includes(TARGET_TEXT)) {
				const banner = span.closest('[role="status"]');
				if (banner) banner.remove();
			}
		});
	};

	const removeTopTabs = () => {
		const homefeed = document.querySelector("a#homefeed");
		if (!homefeed) return;

		const tabsContainer = homefeed.closest('div[style*="top: 80px"]');
		if (tabsContainer) tabsContainer.remove();
	};

	removeBanner();
	removeTopTabs();

	const observer = new MutationObserver(() => {
		removeBanner();
		removeTopTabs();
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
})();
