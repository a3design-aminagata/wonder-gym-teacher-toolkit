// ==UserScript==
// @name         LMS : Common - Layout - Nav
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  LMS講師ポータルのサイドバーをスマホで最適化
// @match        https://wonder-gym.jp/lecturer-portal/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";
	const bgGray800 = "rgb(31 41 55 / var(--tw-bg-opacity))";

	function applyLayoutFix() {
		const container = document.querySelector(
			"div.flex-nowrap.flex.min-h-screen",
		);
		const navBlock = document.querySelector("div.w-\\[250px\\]");
		const navList = document.querySelector("div.w-\\[250px\\] ul.mt-4.text-sm");
		if (!container || !navList || !navBlock) return;

		const titleLi = navList.querySelector("li.font-bold");
		if (titleLi) titleLi.remove();

		if (window.innerWidth <= 1200) {
			/** モバイルレイアウト **/
			container.style.flexDirection = "column";
			navBlock.style.width = "100%";
			navList.style.display = "flex";
			navList.style.overflowX = "auto";
			navList.style.whiteSpace = "nowrap";
			navList.style.marginTop = "8px";
			navList.style.gap = "8px";
			navList.style.padding = "4px 6px";
			navList.style.scrollbarWidth = "thin";
			navList.style.backgroundColor = bgGray800;
			navList.style.borderRadius = "0 0 8px 8px";

			navList.querySelectorAll("li").forEach((li) => {
				li.style.border = "none";
				li.style.padding = "6px 10px";
				li.style.fontSize = "14px";
				li.style.whiteSpace = "nowrap";
				li.style.background = "#1f2937";
				li.style.borderRadius = "6px";
				li.style.flex = "0 0 auto";
			});
		} else {
			/** PCレイアウト復元 **/
			container.style.flexDirection = "";
			navBlock.style.width = "";
			navList.removeAttribute("style");
			navList
				.querySelectorAll("li")
				.forEach((li) => li.removeAttribute("style"));
		}
	}

	// NOTE: テーブル変換ロジックはこのスクリプトから分離
	// テーブルのモバイル変換は別の userscript (`table.user.js`) が担当

	applyLayoutFix();
	window.addEventListener("resize", applyLayoutFix);
})();
