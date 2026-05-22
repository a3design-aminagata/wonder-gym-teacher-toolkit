// ==UserScript==
// @name         Google Meet End Call Confirm
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  Google Meetで通話終了前に「コメントは入力しましたか？」確認を挟む
// @author       Ami Nagata
// @match        https://meet.google.com/*
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	const CONFIRM_MESSAGE =
		"コメントは入力しましたか？\nもう一度📞ボタンを押すと切断します。";
	const SECOND_CLICK_WINDOW_MS = 15000;
	const PROVIDED_SPAN_SELECTOR =
		'span.UTNHae[jscontroller="LBaJxb"][jsname="m9ZlFb"]';

	const END_CALL_LABEL_PATTERNS = [
		/通話を終了/,
		/通話から退出/,
		/ミーティングから退出/,
		/退出/,
		/Leave call/i,
		/End call/i,
		/Hang up/i,
	];

	let armedUntil = 0;
	let clearTimer = null;

	function normalizeText(text) {
		return String(text || "")
			.replace(/\s+/g, " ")
			.trim();
	}

	function matchesEndCallLabel(text) {
		if (!text) return false;
		return END_CALL_LABEL_PATTERNS.some((pattern) => pattern.test(text));
	}

	function getButtonLabel(button) {
		if (!(button instanceof HTMLElement)) return "";

		const attrs = ["aria-label", "data-tooltip", "title"];
		for (const attr of attrs) {
			const value = normalizeText(button.getAttribute(attr));
			if (value) return value;
		}

		const labeledById = button.getAttribute("aria-labelledby");
		if (labeledById) {
			const labelEl = document.getElementById(labeledById);
			const text = normalizeText(labelEl?.textContent);
			if (text) return text;
		}

		return normalizeText(button.textContent);
	}

	function hasEndCallIconText(button) {
		if (!(button instanceof HTMLElement)) return false;

		const iconLikeTexts = [
			...button.querySelectorAll("i, .google-symbols, .material-icons"),
		].map((el) => normalizeText(el.textContent).toLowerCase());

		return iconLikeTexts.some(
			(text) => text === "call_end" || text === "hang_up" || text === "call_end_alt",
		);
	}

	function parseRGB(colorText) {
		const match = String(colorText || "")
			.trim()
			.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
		if (!match) return null;
		return {
			r: Number(match[1]),
			g: Number(match[2]),
			b: Number(match[3]),
		};
	}

	function isRedLike(rgb) {
		if (!rgb) return false;
		return rgb.r >= 170 && rgb.g <= 120 && rgb.b <= 120;
	}

	function hasRedBackground(button) {
		if (!(button instanceof HTMLElement)) return false;

		const sampleNodes = [
			button,
			button.firstElementChild,
			button.querySelector("div"),
			button.querySelector("span"),
		].filter((node) => node instanceof HTMLElement);

		for (const node of sampleNodes) {
			const style = window.getComputedStyle(node);
			const bg = parseRGB(style.backgroundColor);
			if (isRedLike(bg)) return true;
		}

		return false;
	}

	function hasProvidedSpanSignature(button) {
		if (!(button instanceof HTMLElement)) return false;
		return button.querySelector(PROVIDED_SPAN_SELECTOR) instanceof HTMLElement;
	}

	function isLikelyEndCallButton(button) {
		if (!(button instanceof HTMLElement)) return false;
		if (button.getAttribute("aria-disabled") === "true") return false;

		const label = getButtonLabel(button);
		if (matchesEndCallLabel(label)) return true;

		if (hasEndCallIconText(button) && hasRedBackground(button)) return true;

		if (hasProvidedSpanSignature(button) && hasRedBackground(button)) return true;

		return false;
	}

	function clearArmState() {
		armedUntil = 0;
		if (clearTimer) {
			clearTimeout(clearTimer);
			clearTimer = null;
		}
	}

	function armForSecondClick() {
		armedUntil = Date.now() + SECOND_CLICK_WINDOW_MS;
		if (clearTimer) clearTimeout(clearTimer);
		clearTimer = setTimeout(clearArmState, SECOND_CLICK_WINDOW_MS + 50);
	}

	function isWithinArmedWindow() {
		return Date.now() <= armedUntil;
	}

	function notifyFirstClick() {
		window.alert(CONFIRM_MESSAGE);
	}

	function onClickCapture(event) {
		if (!(event.target instanceof Element)) return;

		const button = event.target.closest('button, [role="button"]');
		if (!(button instanceof HTMLElement)) return;
		if (!isLikelyEndCallButton(button)) return;

		if (isWithinArmedWindow()) {
			clearArmState();
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		event.stopPropagation();

		armForSecondClick();
		notifyFirstClick();
	}

	function onKeydownCapture(event) {
		if (!(event.target instanceof Element)) return;
		if (event.key !== "Enter" && event.key !== " ") return;

		const button = event.target.closest('button, [role="button"]');
		if (!(button instanceof HTMLElement)) return;
		if (!isLikelyEndCallButton(button)) return;

		if (isWithinArmedWindow()) {
			clearArmState();
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		event.stopPropagation();

		armForSecondClick();
		notifyFirstClick();
	}

	document.addEventListener("click", onClickCapture, true);
	document.addEventListener("keydown", onKeydownCapture, true);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) clearArmState();
	});
})();
