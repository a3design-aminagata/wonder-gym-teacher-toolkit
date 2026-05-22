// ==UserScript==
// @name         LMS : online_lessons - ChatGPT連動一括入力 (上から順番入力版)
// @namespace    https://github.com/a3design-aminagata/
// @version      2.5
// @description  LMSとChatGPTを一つのスクリプトで制御。自動検知に失敗してもボタン一つでLMSへ送れます。
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*/edit
// @match        https://chatgpt.com/g/g-*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";

	const isLMS = location.hostname.includes("wonder-gym.jp");
	const isChatGPT = location.hostname.includes("chatgpt.com");

	const STORAGE_KEY_PROMPT = "gpt_bridge_data_v2";
	const STORAGE_KEY_STATUS = "gpt_bridge_status_v2";
	const STORAGE_KEY_RESULTS = "gpt_bridge_results_v2";
	const LAYOUT_STYLE_ID = "tm-online-lessons-tools-layout-style";
	const LAYOUT_ROOT_ID = "tm-online-lessons-tools-layout-root";
	const PRIMARY_ROW_ID = "tm-online-lessons-tools-primary-row";
	const SECONDARY_ROW_ID = "tm-online-lessons-tools-secondary-row";

	// ==========================================
	// LMS側の処理
	// ==========================================
	if (isLMS) {
		function initLMS() {
			let GPT_URL = GM_getValue("GPT_BRIDGE_URL") || "https://chatgpt.com/g/g-p-69afaaa707688191a0f82ba5ec9aa7db-wl";

			const targetHeader = Array.from(document.querySelectorAll("h2")).find(
				(el) => el.textContent.includes("参加受講生") && el.classList.contains("border-indigo-500"),
			);
			if (!targetHeader || document.getElementById("chatgpt-bridge-container")) return;
			const layout = ensureToolsLayout(targetHeader);

			const container = document.createElement("div");
			container.id = "chatgpt-bridge-container";
			container.style.cssText = `margin: 10px 1rem 20px 1rem; padding: 20px; background: #f0fdf4; border: 2px solid #10a37f; border-radius: 12px; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 900px;`;
			container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0; font-size:18px; color:#065f46; font-weight:bold;">🚀 ChatGPT連動・一括入力</h3>
                    <button id="gpt-reset-url" type="button" style="background:none; border:none; color:#666; cursor:pointer; font-size:11px; text-decoration:underline;">URL再設定</button>
                </div>
                <textarea id="gpt-memo-input" style="width:100%; height:120px; margin-bottom:12px; padding:12px; border:1px solid #a7f3d0; border-radius:6px; box-sizing:border-box; font-size:14px;" placeholder="Notionメモを貼り付け..."></textarea>
                <button id="gpt-start-btn" type="button" style="width:100%; padding:12px; background:#10a37f; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✨ ChatGPTを起動して生成</button>
                <div id="gpt-status" style="margin-top:12px; font-size:13px; color:#065f46; font-weight:bold; white-space:pre-wrap;">待機中...</div>
            `;
			container.style.order = "2";
			layout.primaryRow.appendChild(container);

			document.getElementById("gpt-reset-url").onclick = () => {
				const newUrl = prompt("GPTsのURLを入力:", GPT_URL);
				if (newUrl) { GM_setValue("GPT_BRIDGE_URL", newUrl.trim()); location.reload(); }
			};

			const statusLabel = document.getElementById("gpt-status");

			document.getElementById("gpt-start-btn").onclick = () => {
				const memoText = document.getElementById("gpt-memo-input").value;
				if (!memoText) return alert("メモを入力してください。");

				statusLabel.innerText = "⏳ ChatGPTタブで生成中... 生成が終わると自動でここに入力されます。\n(もし止まったらChatGPTタブを確認してください)";

				GM_setValue(STORAGE_KEY_PROMPT, memoText);
				GM_setValue(STORAGE_KEY_STATUS, "requesting");
				GM_setValue(STORAGE_KEY_RESULTS, "");

				GM_openInTab(GPT_URL, { active: true });

				const checkInterval = setInterval(() => {
					const status = GM_getValue(STORAGE_KEY_STATUS);
					if (status === "completed") {
						const results = JSON.parse(GM_getValue(STORAGE_KEY_RESULTS) || "[]");
						fillComments(results);
						clearInterval(checkInterval);
						statusLabel.innerText = `✅ ${results.length} 名分の流し込みが完了しました！`;
						GM_setValue(STORAGE_KEY_STATUS, "idle");
					}
				}, 1500);
			};

			function fillComments(comments) {
				const textareas = Array.from(document.querySelectorAll('td[data-field="comment"] textarea'));
				comments.forEach((comment, index) => {
					if (textareas[index]) {
						textareas[index].value = comment;
						textareas[index].dispatchEvent(new Event("input", { bubbles: true }));
						textareas[index].dispatchEvent(new Event("change", { bubbles: true }));
						textareas[index].style.backgroundColor = "#dcfce7";
					}
				});
			}
		}

		if (document.body.dataset.fieldsReady) { initLMS(); }
		else { document.addEventListener("DataFieldsReady", initLMS); }
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

	// ==========================================
	// ChatGPT側の処理
	// ==========================================
	if (isChatGPT) {
		console.log("ChatGPT Bridge Active");

		// 状態監視
		const runBridge = setInterval(() => {
			const status = GM_getValue(STORAGE_KEY_STATUS);
			const promptText = GM_getValue(STORAGE_KEY_PROMPT);

			if (status === "requesting" && promptText) {
				clearInterval(runBridge);
				executeTask(promptText);
			}
		}, 1500);

		async function executeTask(text) {
			GM_setValue(STORAGE_KEY_STATUS, "processing");
			const textarea = document.querySelector('#prompt-textarea');
			if (!textarea) return;

			textarea.focus();
			document.execCommand('insertText', false, text);
			textarea.dispatchEvent(new Event('input', { bubbles: true }));

			setTimeout(() => {
				const sendBtn = document.querySelector('button[data-testid="send-button"]') || document.querySelector('button[aria-label="Send prompt"]');
				if (sendBtn) {
					sendBtn.click();
					showFloatingButton(); // バックアップ用の手動ボタンを表示
					observeChatGPTResponse();
				}
			}, 1000);
		}

		// 手動送信ボタン（自動検知が失敗した時のため）
		function showFloatingButton() {
			if (document.getElementById("gpt-manual-send-btn")) return;
			const btn = document.createElement("button");
			btn.id = "gpt-manual-send-btn";
			btn.innerText = "📤 LMSへ結果を送信する";
			btn.style.cssText = "position:fixed; top:20px; right:20px; z-index:9999; padding:15px 25px; background:#10a37f; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.2);";
			btn.onclick = () => extractAndFinish();
			document.body.appendChild(btn);
		}

		function observeChatGPTResponse() {
			const observer = new MutationObserver((mutations, obs) => {
				// 送信ボタンが復活＝生成完了
				const sendBtn = document.querySelector('button[data-testid="send-button"]');
				const isGenerating = document.querySelector('button[aria-label="Stop generating"]');

				if (!isGenerating && sendBtn) {
					console.log("Generation finished detected.");
					setTimeout(extractAndFinish, 2000);
					obs.disconnect();
				}
			});
			observer.observe(document.body, { childList: true, subtree: true });
		}

		function extractAndFinish() {
			// ページ内のすべてのコードブロックを取得（より確実に）
			const allCodes = Array.from(document.querySelectorAll('pre code'));
            // 最新の回答（最後のほうにあるコードブロック）を優先
			const codes = allCodes.map(el => el.innerText.trim()).filter(text => text.length > 5);

			if (codes.length > 0) {
				GM_setValue(STORAGE_KEY_RESULTS, JSON.stringify(codes));
				GM_setValue(STORAGE_KEY_STATUS, "completed");

				const btn = document.getElementById("gpt-manual-send-btn");
				if (btn) {
					btn.innerText = "✅ 送信完了！";
					btn.style.background = "#059669";
					setTimeout(() => btn.remove(), 2000);
				}
                // window.close(); // 必要なら有効化
			} else {
				alert("コードブロックが見つかりませんでした。回答が完全に終わっているか確認してください。");
			}
		}
	}
})();
