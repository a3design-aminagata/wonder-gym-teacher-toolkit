// ==UserScript==
// @name         LMS : Common - Favicon From Logo (URL Color Change)
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  LMSヘッダーSVGロゴをfaviconにし、特定URLで色変更
// @match        https://wonder-gym.jp/*
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	function replaceFaviconFromSVG() {
		const svgEl = document.querySelector(".shrink-0.flex.items-center svg");
		if (!svgEl) return;

		// SVGをclone（元を壊さない）
		const cloned = svgEl.cloneNode(true);

		// URL判定
		const isLessonEdit = location.pathname.includes(
			"/online-lesson-attendances/online_lessons/",
		);

		if (isLessonEdit) {
			// 色変更（例：赤）
			cloned.querySelectorAll("*").forEach((el) => {
				if (el.hasAttribute("fill")) {
					el.setAttribute("fill", "#f05277");
				}
				if (el.hasAttribute("stroke")) {
					el.setAttribute("stroke", "#f05277");
				}
			});
		}

		const svgString = cloned.outerHTML.trim();
		const svgDataUrl = "data:image/svg+xml," + encodeURIComponent(svgString);

		document
			.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
			.forEach((el) => el.remove());

		const link = document.createElement("link");
		link.rel = "icon";
		link.type = "image/svg+xml";
		link.href = svgDataUrl;
		document.head.appendChild(link);
	}

	const observer = new MutationObserver(() => replaceFaviconFromSVG());
	observer.observe(document.body, { childList: true, subtree: true });

	replaceFaviconFromSVG();
})();
