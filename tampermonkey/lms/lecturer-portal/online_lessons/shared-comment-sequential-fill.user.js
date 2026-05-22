// ==UserScript==
// @name         LMS : online_lessons - 講師用共有コメント 上から順入力
// @namespace    https://github.com/a3design-aminagata/
// @version      1.0
// @description  入力テキストから受講生ごとの共有コメントブロックを抽出し、講師用共有コメント欄に上から順に入力します。
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*/edit
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	const CONTAINER_ID = "tm-shared-comment-sequential-fill";
	const LAYOUT_STYLE_ID = "tm-online-lessons-tools-layout-style";
	const LAYOUT_ROOT_ID = "tm-online-lessons-tools-layout-root";
	const PRIMARY_ROW_ID = "tm-online-lessons-tools-primary-row";
	const SECONDARY_ROW_ID = "tm-online-lessons-tools-secondary-row";

	if (document.body.dataset.fieldsReady) {
		init();
	} else {
		document.addEventListener("DataFieldsReady", init);
		setTimeout(init, 1500); // data.js が無効でも最低限動くようにフォールバック
	}

	function init() {
		if (document.getElementById(CONTAINER_ID)) return;

		const targetHeader = Array.from(document.querySelectorAll("h2")).find(
			(el) =>
				el.textContent.includes("参加受講生") &&
				el.classList.contains("border-indigo-500"),
		);
		if (!targetHeader) return;
		const layout = ensureToolsLayout(targetHeader);

		const container = document.createElement("div");
		container.id = CONTAINER_ID;
		container.style.cssText =
			"margin: 10px 1rem 20px 1rem; padding: 20px; background: #ffffff; border: 2px solid #0ea5e9; border-radius: 12px; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); max-width: 900px;";
		container.innerHTML = `
            <h3 style="margin:0 0 10px 0; font-size:18px; color:#0c4a6e; font-weight:bold;">講師用共有コメント 一括入力 (上から順)</h3>
            <p style="font-size:12px; color:#475569; margin:0 0 8px 0;">入力形式: 〈名前〉さん + \`\`\` ... \`\`\` を複数貼り付けると、上から順に「講師用共有コメント」へ流し込みます。</p>
            <textarea id="tm-shared-comment-input" style="width:100%; height:220px; margin-bottom:12px; padding:12px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; font-size:13px; line-height:1.5;" placeholder="入力テキストをここに貼り付けてください..."></textarea>
            <button id="tm-shared-comment-apply" type="button" style="width:100%; padding:12px; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:15px;">講師用共有コメントへ上から順に入力</button>
            <div id="tm-shared-comment-status" style="margin-top:12px; font-size:13px; color:#334155; font-weight:bold; white-space:pre-wrap;">待機中...</div>
            `;
		layout.secondaryRow.appendChild(container);

		const applyButton = document.getElementById("tm-shared-comment-apply");
		const inputArea = document.getElementById("tm-shared-comment-input");
		const statusLabel = document.getElementById("tm-shared-comment-status");

		applyButton.addEventListener("click", (e) => {
			e.preventDefault();
			const rawText = inputArea.value;
			if (!rawText.trim()) {
				statusLabel.textContent = "入力テキストが空です。";
				statusLabel.style.color = "#dc2626";
				return;
			}

			const blocks = parseBlocks(rawText);
			if (blocks.length === 0) {
				statusLabel.textContent =
					"ブロックを抽出できませんでした。\n形式: 〈名前〉さん の次行に ```...``` を置いてください。";
				statusLabel.style.color = "#dc2626";
				return;
			}

			const targetTextareas = getSharedCommentTextareas();
			if (targetTextareas.length === 0) {
				statusLabel.textContent =
					"講師用共有コメントの入力欄を見つけられませんでした。";
				statusLabel.style.color = "#dc2626";
				return;
			}

			let applied = 0;
			blocks.forEach((block, index) => {
				const textarea = targetTextareas[index];
				if (!textarea) return;

				textarea.value = block;
				textarea.dispatchEvent(new Event("input", { bubbles: true }));
				textarea.dispatchEvent(new Event("change", { bubbles: true }));
				textarea.style.backgroundColor = "#ecfeff";
				applied += 1;
			});

			const skipped = blocks.length - applied;
			statusLabel.style.color = "#0f766e";
			statusLabel.textContent =
				skipped > 0
					? `${applied} 件入力しました。\n${skipped} 件は入力欄不足でスキップしました。`
					: `${applied} 件の入力を完了しました。`;
		});
	}

	function ensureToolsLayout(targetHeader) {
		if (!document.getElementById(LAYOUT_STYLE_ID)) {
			const style = document.createElement("style");
			style.id = LAYOUT_STYLE_ID;
			style.textContent = `
                #${LAYOUT_ROOT_ID} {
                    margin: 20px 1rem;
                    max-width: 900px;
                }
                #${PRIMARY_ROW_ID} {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                    margin-bottom: 12px;
                }
                #${SECONDARY_ROW_ID} {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                #${PRIMARY_ROW_ID} > div,
                #${SECONDARY_ROW_ID} > div {
                    margin: 0 !important;
                    max-width: none !important;
                }
                @media (max-width: 500px) {
                    #${PRIMARY_ROW_ID} {
                        grid-template-columns: 1fr;
                    }
                }
            `;
			document.head.appendChild(style);
		}

		let root = document.getElementById(LAYOUT_ROOT_ID);
		if (!root) {
			root = document.createElement("div");
			root.id = LAYOUT_ROOT_ID;
			root.innerHTML = `
                <div id="${PRIMARY_ROW_ID}"></div>
                <div id="${SECONDARY_ROW_ID}"></div>
            `;
			targetHeader.insertAdjacentElement("beforebegin", root);
		}

		return {
			primaryRow: document.getElementById(PRIMARY_ROW_ID),
			secondaryRow: document.getElementById(SECONDARY_ROW_ID),
		};
	}

	function getSharedCommentTextareas() {
		const byDataField = Array.from(
			document.querySelectorAll('td[data-field="shared_comment"] textarea'),
		);
		if (byDataField.length > 0) return byDataField;

		const byName = Array.from(
			document.querySelectorAll(
				'textarea[name*="[shared_comment]"], textarea[name*="shared_comment"]',
			),
		);
		if (byName.length > 0) return byName;

		return Array.from(
			document.querySelectorAll("table tbody tr td:first-child textarea"),
		);
	}

	function parseBlocks(rawText) {
		const text = rawText.replace(/\r\n?/g, "\n").trim();
		if (!text) return [];

		const fenceBlocks = [];
		const fencedPattern =
			/(?:^|\n)\s*[〈<]?\s*([^\n〈〉<>]+?)\s*[〉>]?\s*さん\s*\n```(?:[\w-]+)?\n?([\s\S]*?)```/g;
		let match;

		while ((match = fencedPattern.exec(text)) !== null) {
			const name = sanitizeName(match[1]);
			const body = (match[2] || "").trim();
			if (!name || !body) continue;
			fenceBlocks.push(formatSharedComment(name, body));
		}
		if (fenceBlocks.length > 0) return fenceBlocks;

		// フェンスなしテキスト向けの緩めフォールバック
		const plainBlocks = [];
		const plainPattern =
			/(?:^|\n)\s*[〈<]?\s*([^\n〈〉<>]+?)\s*[〉>]?\s*さん\s*\n([\s\S]*?)(?=(?:\n\s*[〈<]?\s*[^\n〈〉<>]+?\s*[〉>]?\s*さん\s*\n)|$)/g;
		while ((match = plainPattern.exec(text)) !== null) {
			const name = sanitizeName(match[1]);
			const body = (match[2] || "").trim();
			if (!name || !body) continue;
			plainBlocks.push(formatSharedComment(name, body));
		}

		return plainBlocks;
	}

	function sanitizeName(name) {
		return (name || "").replace(/\s+/g, " ").trim();
	}

	function formatSharedComment(name, body) {
		return `〈${name}〉さん\n${body.trim()}`;
	}
})();
