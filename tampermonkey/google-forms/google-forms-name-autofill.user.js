// ==UserScript==
// @name         Googleフォーム名前自動入力（設定ボタン付き）
// @namespace    https://github.com/a3design-aminagata/
// @version      1.2
// @description  Googleフォームで「お名前」欄に自動で名前を入力し、変更も簡単にできます
// @author       Ami Nagata
// @match        https://docs.google.com/forms/d/e/*/viewform*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
	"use strict";

	const EXCLUDED_FORM_IDS_KEY = "excludedFormIds";

	function getCurrentFormId() {
		const match = window.location.pathname.match(/\/forms\/d\/e\/([^/]+)\//i);
		return match?.[1] ? match[1].toLowerCase() : "";
	}

	function normalizeFormIdList(values) {
		if (!Array.isArray(values)) return [];
		return values
			.map((v) => String(v || "").trim().toLowerCase())
			.filter(Boolean);
	}

	function loadExcludedFormIds() {
		const raw = GM_getValue(EXCLUDED_FORM_IDS_KEY, []);
		if (typeof raw === "string") {
			try {
				return normalizeFormIdList(JSON.parse(raw));
			} catch {
				return [];
			}
		}
		return normalizeFormIdList(raw);
	}

	function saveExcludedFormIds(ids) {
		GM_setValue(EXCLUDED_FORM_IDS_KEY, Array.from(new Set(normalizeFormIdList(ids))));
	}

	function excludeCurrentForm(currentFormId) {
		if (!currentFormId) return;
		const ids = loadExcludedFormIds();
		ids.push(currentFormId);
		saveExcludedFormIds(ids);
		alert("このフォームを除外リストに追加しました。ページを再読み込みしてください。");
	}

	function unexcludeCurrentForm(currentFormId) {
		if (!currentFormId) return;
		const ids = loadExcludedFormIds().filter((id) => id !== currentFormId);
		saveExcludedFormIds(ids);
		alert("このフォームを除外リストから解除しました。ページを再読み込みしてください。");
	}

	function showExcludedForms() {
		const ids = loadExcludedFormIds();
		if (ids.length === 0) {
			alert("除外フォームは登録されていません。");
			return;
		}
		alert(`除外フォームID一覧:\n${ids.join("\n")}`);
	}

	const currentFormId = getCurrentFormId();
	const isCurrentFormExcluded =
		Boolean(currentFormId) && loadExcludedFormIds().includes(currentFormId);

	if (currentFormId) {
		if (isCurrentFormExcluded) {
			GM_registerMenuCommand("このフォームを除外から解除", () =>
				unexcludeCurrentForm(currentFormId),
			);
		} else {
			GM_registerMenuCommand("このフォームを除外に追加", () =>
				excludeCurrentForm(currentFormId),
			);
		}
	}
	GM_registerMenuCommand("除外フォーム一覧を表示", showExcludedForms);

	if (isCurrentFormExcluded) {
		return;
	}

	// 1. 保存されている名前を取得する（なければ初回プロンプトで入力させる）
	let myName = GM_getValue("savedName", "");
	if (!myName) {
		myName = prompt(
			"【Googleフォーム自動入力】\n自動入力したいあなたのフルネームを入力してください:",
		);
		if (myName) {
			GM_setValue("savedName", myName);
		} else {
			return; // キャンセルされた場合は何もしない
		}
	}

	// ====== ここから追加：名前変更機能 ======

	// 名前を変更する関数
	function updateName() {
		const currentName = GM_getValue("savedName", "");
		// 現在の名前を初期値として入力欄に表示する
		const newName = prompt(
			"自動入力する名前を変更します。\n新しい名前を入力してください:",
			currentName,
		);

		if (newName !== null && newName !== "") {
			// キャンセルや空欄でなければ保存して更新
			GM_setValue("savedName", newName);
			myName = newName;

			// 強制的に入力欄を新しい名前に上書きする
			fillName(true);

			// 画面の右下に小さく通知を出す（アラートだと邪魔なので）
			showToast(`名前を「${newName}」に変更しました！`);
		}
	}

	// Tampermonkeyのアイコンメニューにも「名前を変更する」を追加しておく
	GM_registerMenuCommand("自動入力する名前を変更する", updateName);

	// 画面の右下に設定ボタンを追加する
	function createSettingButton() {
		const btn = document.createElement("button");
		btn.textContent = "⚙️ 名前変更";

		// フォームの邪魔にならない右下に固定配置
		btn.style.position = "fixed";
		btn.style.bottom = "70px";
		btn.style.right = "20px";
		btn.style.padding = "8px 12px";
		btn.style.backgroundColor = "#fff";
		btn.style.color = "#5f6368";
		btn.style.border = "1px solid #dadce0";
		btn.style.borderRadius = "20px";
		btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
		btn.style.cursor = "pointer";
		btn.style.zIndex = "9999"; // 他の要素より手前に表示
		btn.style.fontFamily = "sans-serif";
		btn.style.fontSize = "14px";
		btn.style.transition = "background-color 0.2s";

		// マウスが乗った時の色変化
		btn.onmouseover = () => (btn.style.backgroundColor = "#f1f3f4");
		btn.onmouseout = () => (btn.style.backgroundColor = "#fff");

		// クリックされたら名前変更処理を呼び出す
		btn.onclick = (e) => {
			e.preventDefault(); // フォームの誤送信を防ぐ
			updateName();
		};

		document.body.appendChild(btn);
	}

	// 更新完了を知らせる小さなポップアップ（トースト通知）
	function showToast(message) {
		const toast = document.createElement("div");
		toast.textContent = message;
		toast.style.position = "fixed";
		toast.style.bottom = "70px"; // ボタンの少し上に表示
		toast.style.right = "20px";
		toast.style.backgroundColor = "#323232";
		toast.style.color = "#fff";
		toast.style.padding = "10px 15px";
		toast.style.borderRadius = "8px";
		toast.style.zIndex = "9999";
		toast.style.fontSize = "14px";
		toast.style.opacity = "0";
		toast.style.transition = "opacity 0.3s";

		document.body.appendChild(toast);

		// ふわっと表示して2秒後に消す
		setTimeout(() => {
			toast.style.opacity = "1";
		}, 10);
		setTimeout(() => {
			toast.style.opacity = "0";
			setTimeout(() => toast.remove(), 300); // 完全に消えたらHTMLから削除
		}, 2000);
	}
	// ====== 追加ここまで ======

	// 2. ページが読み込まれてから少し待って処理を実行
	window.addEventListener("load", () => {
		setTimeout(() => {
			fillName(false); // 初回は空欄の場合のみ入力
			createSettingButton(); // ボタンを画面に配置
		}, 500);
	});

	// forceOverwriteフラグを追加。trueなら既に入力されていても上書きする
	function fillName(forceOverwrite = false) {
		const questionBlocks = document.querySelectorAll(".geS5n");

		questionBlocks.forEach((block) => {
			const titleEl = block.querySelector(".M7eMe");

			if (
				titleEl &&
				(titleEl.textContent.includes("名前") ||
					titleEl.textContent.includes("お名前"))
			) {
				const inputEl = block.querySelector('input[type="text"]');

				// 入力欄が存在し、（何も入力されていない、または 強制上書きモード）の場合
				if (inputEl && (!inputEl.value || forceOverwrite)) {
					inputEl.focus();
					inputEl.value = myName;
					inputEl.dispatchEvent(new Event("input", { bubbles: true }));
					inputEl.dispatchEvent(new Event("change", { bubbles: true }));
					inputEl.blur();
				}
			}
		});
	}
})();
