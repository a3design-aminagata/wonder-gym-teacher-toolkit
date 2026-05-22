// ==UserScript==
// @name         Google Meet Auto Close Muted Warning
// @namespace    https://github.com/a3design-aminagata/
// @version      2.1
// @description  Google Meetの「マイクがオフ」警告ポップアップの閉じるボタンを自動クリックします
// @author       Ami Nagata
// @match        https://meet.google.com/*
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	const TARGET_LABEL_PATTERNS = [
		/マイクがオフになっているため、相手には聞こえていません。?/,
		/You'?re muted/i,
		/others can'?t hear you/i,
	];

	const TEXT_GROUPS = [
		[/マイクがオフ/, /相手には聞こえていません/],
		[/マイクがオフ/, /オンにしてください/],
		[/you'?re muted/i, /can'?t hear you/i],
	];

	function normalizeText(text) {
		return text.replace(/\s+/g, " ").trim();
	}

	function matchesAnyPattern(text, patterns) {
		return patterns.some((pattern) => pattern.test(text));
	}

	function matchesTextGroup(text) {
		return TEXT_GROUPS.some((group) =>
			group.every((pattern) => pattern.test(text)),
		);
	}

	function findDialogCandidate(node) {
		if (!(node instanceof Element)) return null;
		if (node.getAttribute("role") === "dialog") return node;
		return node.closest('[role="dialog"]');
	}

	function isTargetDialog(el) {
		if (!(el instanceof HTMLElement)) return false;
		if (el.getAttribute("role") !== "dialog") return false;

		const ariaLabel = normalizeText(el.getAttribute("aria-label") || "");
		if (ariaLabel && matchesAnyPattern(ariaLabel, TARGET_LABEL_PATTERNS)) {
			return true;
		}

		const text = normalizeText(el.textContent || "");
		return text !== "" && matchesTextGroup(text);
	}

	function findCloseButton(dialogEl) {
		if (!(dialogEl instanceof HTMLElement)) return null;

		const selectors = [
			'button[jsname="plIjzf"]',
			'button[aria-label="閉じる"]',
			'button[aria-label="Close"]',
			'[role="button"][aria-label="閉じる"]',
			'[role="button"][aria-label="Close"]',
		];

		for (const selector of selectors) {
			const button = dialogEl.querySelector(selector);
			if (button instanceof HTMLElement) return button;
		}

		// Materialボタン内部の波紋要素クラスから逆引き（UI差分対策）
		const ripple = dialogEl.querySelector(".VYBDae-Bz112c-RLmnJb");
		if (ripple instanceof HTMLElement) {
			const button = ripple.closest('button,[role="button"]');
			if (button instanceof HTMLElement) return button;
		}

		return null;
	}

	function clickCloseIfTarget(dialogEl) {
		if (!isTargetDialog(dialogEl)) return;
		if (dialogEl.getAttribute("data-tm-muted-warning-closed") === "1") return;

		const closeButton = findCloseButton(dialogEl);
		if (!closeButton) {
			const escEvent = new KeyboardEvent("keydown", {
				key: "Escape",
				code: "Escape",
				keyCode: 27,
				which: 27,
				bubbles: true,
			});
			dialogEl.dispatchEvent(escEvent);
			document.dispatchEvent(escEvent);
			return;
		}

		dialogEl.setAttribute("data-tm-muted-warning-closed", "1");
		closeButton.click();
	}

	function scan(root = document) {
		if (!(root instanceof Element || root instanceof Document)) return;
		if (root instanceof Element) {
			const dialog = findDialogCandidate(root);
			if (dialog) clickCloseIfTarget(dialog);
		}
		root.querySelectorAll('[role="dialog"]').forEach(clickCloseIfTarget);
	}

	let scanScheduled = false;
	function scheduleScan() {
		if (scanScheduled) return;
		scanScheduled = true;
		requestAnimationFrame(() => {
			scanScheduled = false;
			scan();
		});
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof Element) scan(node);
				});
				continue;
			}

			const targetDialog = findDialogCandidate(mutation.target);
			if (targetDialog) clickCloseIfTarget(targetDialog);
		}

		// 取りこぼし対策
		scheduleScan();
	});

	scan();

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
	});

	// 既存ノード再利用で通知が出るケース向けの最終フォールバック
	setInterval(scan, 800);
})();
