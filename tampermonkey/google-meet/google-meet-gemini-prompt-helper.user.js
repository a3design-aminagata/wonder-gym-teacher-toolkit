// ==UserScript==
// @name         Google Meet Gemini - Prompt Helper
// @namespace    https://github.com/a3design-aminagata/
// @version      2.3
// @description  Google MeetのGemini入力を補助する統合ボタンUI（折りたたみ対応）
// @author       Ami Nagata
// @match        https://meet.google.com/*
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	const GLOBAL_KEY = "__meetGeminiHelperUnified__";
	if (window[GLOBAL_KEY]?.mounted) return;

	const ROOT_ID = "meet-gemini-helper-root";
	const ATTENTION_MINUTE = 50;
	const ATTENTION_STYLE_ID = "gmgh-attention-style";
	const ATTENTION_CHECK_INTERVAL_MS = 5000;

	const INSTRUCTOR_PROMPT = `あなたはプロのデザイン講師です。
Google Meetの会話ログから、生徒本人が実際に発言した内容や授業中の反応をもとに、講師コメントを作成してください。

# 最重要ルール
1. 発言ログに存在しない内容を絶対に補完・推測・創作しない。
2. 必ず、生徒本人が実際に話した内容・質問・リアクションのみを根拠に評価する。
3. 他人の発言を混ぜない。

# 評価の指針
1. 「〜に取り組めていた（行動）」ではなく、「〜を分析できていた」「〜を言語化できていた（思考・表現）」という切り口で評価してください。
2. 具体的な固有名詞（赤、金、ラーメン、餃子等）は「配色」「主題」「コンセプト」といったデザイン用語に抽象化してください。
3. 発表内容から、生徒が「どこに注目して」「どう論理的に考えたか」を肯定的に記述してください。

# 厳守ルール
1. 【文字数】100文字以内、2〜3文で言い切ること。
2. 【報告禁止】「〜と言っていました」「〜と発表してくれた」は厳禁。すべて「〜を考察できていた」等の講師評価（プロの眼差し）に変換すること。
3. 【語尾】「〜できていました」「〜と言えます」などが良い。

# 理想とするトーンの例
「デザインの意図を客観的に分析し、配色やフォントが与える視覚効果を的確に言語化できていました。全体のバランスを考慮した具体的な改善案を提示できており、視点が非常に論理的です。」
「主題の魅力を引き出すためのレイアウトについて、鋭い考察が見られました。ユーザー視点に立ったフォント選定や要素の配置など、目的を持ったデザイン設計を思考できています。」
「現状の課題を具体的に把握し、論理的な根拠を持って改善の方向性を提示できていました。UI/UXの観点から導線や要素の強弱を分析できており、説得力のある発表でした。」

# 出力形式
〈名前〉さん
\`\`\`
コメント本文
\`\`\``;

	const SHARED_COMMENT_PROMPT = `あなたはデザイン講師の引き継ぎアシスタントです。これまでの会話内容から、{出力例}を参考に、
	生徒の「講師用共有コメント」に使える情報を抽出して整形してください。

# 抽出対象
1. 前職
2. Web/IT経験
3. 興味・好きなもの（デザイン以外も可）
4. 引き継ぎメモ（学習姿勢、理解度、注意点、次回に活かせること）

# 出力例
例1）
Web/IT経験：少しあり
前職：医療事務
職歴：旅行会社、航空会社、医療事務（文字起こし）
1988年生まれ

例2）
4/9伊東
事前欠席連絡あり

Web/IT経験：あり（YouTube動画編集、Office）
前職：介護職

# 厳守ルール
1. 事実ベースで書く。推測しない。
2. 情報がない項目は書かなくて良い（項目を作らなくて良い）。
3. 各項目は1行で簡潔に書く（長文にしない）。
4. ネガティブ表現は避け、講師間で共有しやすい中立的な言い回しにする。

# 出力形式
〈名前〉さん
\`\`\`
【前職】
（内容）

【Web/IT経験】
（内容）

【興味・好きなもの】
（内容）

【引き継ぎメモ】
（内容）

\`\`\`
`;

	const promptItems = [
		{
			label: "講師コメント",
			text: INSTRUCTOR_PROMPT,
			variant: "primary",
		},
		{
			label: "共有コメント",
			text: SHARED_COMMENT_PROMPT,
		},
		{
			label: "直前の人の要約",
			text: "直前に発言した人の内容だけを、箇条書きで要約して",
		},
		{
			label: "最後の人の発言全部",
			text: "最後に喋った人の発言内容を、話し始めたところから最後までまとめて",
		},
		{
			label: "今話してる人の要点",
			text: "今話している（または直前に話していた）人の要点を短く教えて",
		},
	];

	function findInputField() {
		let inputField = document.querySelector(
			'div[jsname="ZeIRi"][contenteditable="true"]',
		);
		if (!inputField) {
			inputField = document.querySelector(
				'div[role="combobox"][contenteditable="true"]',
			);
		}
		return inputField;
	}

	function insertText(text) {
		const inputField = findInputField();
		if (!inputField) {
			alert(
				"Geminiの入力欄が見つかりません。右上の星マークをクリックしてGeminiパネルを開いてください。",
			);
			return;
		}

		inputField.focus();
		inputField.innerText = text;

		const inputEvent = new InputEvent("input", {
			bubbles: true,
			cancelable: true,
			inputType: "insertText",
			data: text,
		});
		inputField.dispatchEvent(inputEvent);
		inputField.dispatchEvent(new Event("input", { bubbles: true }));
	}

	function applyCollapsedState(root, collapsed) {
		const body = root.querySelector(".gmgh-body");
		const toggle = root.querySelector(".gmgh-toggle");
		const header = root.querySelector(".gmgh-header");
		if (!body || !toggle || !header) return;

		body.style.display = collapsed ? "none" : "flex";
		toggle.textContent = collapsed ? "+" : "−";
		toggle.title = collapsed ? "展開" : "最小化";
		root.style.width = collapsed ? "24px" : "186px";
		root.style.padding = collapsed ? "0" : "6px";
		root.style.border = collapsed ? "none" : "1px solid #dadce0";
		root.style.background = collapsed
			? "transparent"
			: "rgba(255, 255, 255, 0.14)";
		root.style.boxShadow = collapsed ? "none" : "0 2px 6px rgba(0, 0, 0, 0.12)";
		root.style.backdropFilter = collapsed ? "none" : "blur(1px)";
		header.style.marginBottom = collapsed ? "0" : "6px";
		root.dataset.collapsed = collapsed ? "1" : "0";
		syncAttentionState(root);
	}

	function ensureAttentionStyle() {
		if (document.getElementById(ATTENTION_STYLE_ID)) return;
		if (!document.head) return;

		const style = document.createElement("style");
		style.id = ATTENTION_STYLE_ID;
		style.textContent = `
			@keyframes gmghMinute50Pulse {
				0%, 100% {
					background: rgba(255, 246, 222, 0.82);
					box-shadow: 0 0 0 2px rgba(251, 188, 4, 0.30), 0 5px 15px rgba(0, 0, 0, 0.20);
				}
				50% {
					background: rgba(255, 230, 160, 0.95);
					box-shadow: 0 0 0 2px rgba(251, 188, 4, 0.52), 0 10px 22px rgba(0, 0, 0, 0.26);
				}
			}

			@keyframes gmghMinute50PulseButton {
				0%, 100% {
					background: #fff4ce;
					box-shadow: 0 0 0 1px rgba(249, 171, 0, 0.38), 0 0 0 rgba(249, 171, 0, 0.00);
				}
				50% {
					background: #ffe08a;
					box-shadow: 0 0 0 1px rgba(249, 171, 0, 0.58), 0 0 0 5px rgba(249, 171, 0, 0.22);
				}
			}

			#${ROOT_ID}[data-attention="1"]:not([data-collapsed="1"]) {
				border-color: #f9ab00 !important;
				animation: gmghMinute50Pulse 2.8s ease-in-out infinite;
			}

			#${ROOT_ID}[data-attention="1"] .gmgh-toggle {
				border-color: #f9ab00 !important;
				background: #fff4ce !important;
				color: #6f4300 !important;
				animation: gmghMinute50PulseButton 2.2s ease-in-out infinite !important;
			}
		`;

		document.head.appendChild(style);
	}

	function syncAttentionState(root = document.getElementById(ROOT_ID)) {
		if (!root) return;
		const toggle = root.querySelector(".gmgh-toggle");
		const minute = new Date().getMinutes();
		const shouldAttention = minute >= ATTENTION_MINUTE;
		root.dataset.attention = shouldAttention ? "1" : "0";

		// CSS適用が弱い環境向けのフォールバック
		if (toggle instanceof HTMLButtonElement) {
			if (shouldAttention) {
				toggle.style.borderColor = "#f9ab00";
				toggle.style.background = "#fff4ce";
				toggle.style.color = "#6f4300";
				toggle.style.animation =
					"gmghMinute50PulseButton 2.2s ease-in-out infinite";
			} else {
				toggle.style.borderColor = "#dadce0";
				toggle.style.background = "#ffffff";
				toggle.style.color = "#3c4043";
				toggle.style.animation = "none";
			}
		}
	}

	function createRoot() {
		const root = document.createElement("div");
		root.id = ROOT_ID;
		Object.assign(root.style, {
			position: "fixed",
			top: "10px",
			left: "8px",
			zIndex: "10001",
			width: "186px",
			padding: "6px",
			borderRadius: "10px",
			border: "1px solid #dadce0",
			background: "rgba(255, 255, 255, 0.14)",
			boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
			backdropFilter: "blur(1px)",
			fontFamily: "sans-serif",
		});
		root.dataset.attention = "0";

		const header = document.createElement("div");
		header.className = "gmgh-header";
		Object.assign(header.style, {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-start",
			marginBottom: "6px",
		});

		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "gmgh-toggle";
		Object.assign(toggle.style, {
			width: "24px",
			height: "24px",
			padding: "0",
			border: "1px solid #dadce0",
			borderRadius: "999px",
			background: "#ffffff",
			color: "#3c4043",
			fontSize: "13px",
			fontWeight: "700",
			cursor: "pointer",
			lineHeight: "1",
		});

		toggle.addEventListener("click", () => {
			const collapsed = root.dataset.collapsed === "1";
			const next = !collapsed;
			applyCollapsedState(root, next);
		});

		header.appendChild(toggle);
		root.appendChild(header);

		const body = document.createElement("div");
		body.className = "gmgh-body";
		Object.assign(body.style, {
			display: "flex",
			flexDirection: "column",
			gap: "6px",
		});

		promptItems.forEach((item) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.textContent = item.label;
			Object.assign(btn.style, {
				padding: "5px 7px",
				fontSize: "10px",
				fontWeight: "700",
				textAlign: "left",
				borderRadius: "7px",
				cursor: "pointer",
				whiteSpace: "nowrap",
				border:
					item.variant === "primary"
						? "1px solid #1a73e8"
						: "1px solid #dadce0",
				color: item.variant === "primary" ? "#ffffff" : "#1a73e8",
				background: item.variant === "primary" ? "#1a73e8" : "#ffffff",
			});

			btn.addEventListener("mouseenter", () => {
				btn.style.opacity = "0.88";
			});
			btn.addEventListener("mouseleave", () => {
				btn.style.opacity = "1";
			});
			btn.addEventListener("click", () => insertText(item.text));

			body.appendChild(btn);
		});

		root.appendChild(body);
		applyCollapsedState(root, true);
		syncAttentionState(root);

		return root;
	}

	function isTypingContext() {
		const active = document.activeElement;
		if (!active) return false;
		if (active instanceof HTMLInputElement) return true;
		if (active instanceof HTMLTextAreaElement) return true;
		if (active instanceof HTMLElement && active.isContentEditable) return true;
		return false;
	}

	function toggleByHotkey() {
		const root = document.getElementById(ROOT_ID);
		if (!root) return;
		const collapsed = root.dataset.collapsed === "1";
		applyCollapsedState(root, !collapsed);
	}

	function ensureUi() {
		if (!document.body) return;
		ensureAttentionStyle();

		const existingRoot = document.getElementById(ROOT_ID);
		if (existingRoot) {
			syncAttentionState(existingRoot);
			return;
		}

		const root = createRoot();
		document.body.appendChild(root);
		syncAttentionState(root);
	}

	window[GLOBAL_KEY] = {
		mounted: true,
		ensureUi,
	};

	window.addEventListener("load", () => {
		setTimeout(ensureUi, 2500);
	});

	document.addEventListener("keydown", (event) => {
		if (event.defaultPrevented) return;
		if (event.repeat) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key.toLowerCase() !== "x") return;
		if (isTypingContext()) return;
		event.preventDefault();
		toggleByHotkey();
	});

	setInterval(() => {
		ensureUi();
		syncAttentionState();
	}, ATTENTION_CHECK_INTERVAL_MS);
})();
