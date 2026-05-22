// ==UserScript==
// @name         LMS : online_lessons - AIコメント一括入力 (上から順番入力版)
// @namespace    https://github.com/a3design-aminagata/
// @version      4.2
// @description  名前照合を行わず、AIが生成した順番通りに上から入力します。
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*/edit
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
	"use strict";
	const LAYOUT_STYLE_ID = "tm-online-lessons-tools-layout-style";
	const LAYOUT_ROOT_ID = "tm-online-lessons-tools-layout-root";
	const PRIMARY_ROW_ID = "tm-online-lessons-tools-primary-row";
	const SECONDARY_ROW_ID = "tm-online-lessons-tools-secondary-row";

	if (document.body.dataset.fieldsReady) {
		init();
	} else {
		document.addEventListener("DataFieldsReady", init);
	}

	function init() {
		let API_KEY = GM_getValue("GEMINI_API_KEY");
		function setApiKey() {
			const newKey = prompt("Gemini APIキーを入力してください:");
			if (newKey) {
				GM_setValue("GEMINI_API_KEY", newKey.trim());
				location.reload();
			}
		}
		if (!API_KEY || API_KEY.length < 10) {
			setApiKey();
			return;
		}

		const targetHeader = Array.from(document.querySelectorAll("h2")).find(
			(el) =>
				el.textContent.includes("参加受講生") &&
				el.classList.contains("border-indigo-500"),
		);
		if (!targetHeader || document.getElementById("ai-generator-container"))
			return;
		const layout = ensureToolsLayout(targetHeader);

		const container = document.createElement("div");
		container.id = "ai-generator-container";
		container.style.cssText = `margin: 20px 1rem; padding: 20px; background: #ffffff; border: 2px solid #6366f1; border-radius: 12px; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 900px;`;
		container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:18px; color:#312e81; font-weight:bold;">🤖 AIコメント一括入力 (上から順に流し込み)</h3>
                <button id="ai-reset-key" type="button" style="background:none; border:none; color:#999; cursor:pointer; font-size:11px; text-decoration:underline;">キー再設定</button>
            </div>
            <p style="font-size:12px; color:#666; margin-bottom:8px;">※メモの順番通りに上から入力されます。順番が違う場合は手動で調整してください。</p>
            <textarea id="ai-memo-input" style="width:100%; height:150px; margin-bottom:12px; padding:12px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:14px; line-height:1.5;" placeholder="Notionのメモを貼り付け..."></textarea>
            <button id="ai-generate-btn" type="button" style="width:100%; padding:12px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:15px;">✨ コメントを生成して上から順に入力</button>
            <div id="ai-status" style="margin-top:12px; font-size:13px; color:#4b5563; font-weight:bold; white-space:pre-wrap;">待機中...</div>
            `;
		container.style.order = "1";
		layout.primaryRow.appendChild(container);
		document.getElementById("ai-reset-key").onclick = setApiKey;

		// 試行するモデル
		const models = [
			"gemini-3.1-flash-lite-preview",
			"gemini-3-flash-preview",
			"gemini-2.5-flash-lite",
			"gemini-2.5-flash",
		];

		document
			.getElementById("ai-generate-btn")
			.addEventListener("click", async (e) => {
				e.preventDefault();
				const memoText = document.getElementById("ai-memo-input").value;
				if (!memoText) return;

				const statusLabel = document.getElementById("ai-status");
				statusLabel.innerText = "⏳ AI解析中...";
				statusLabel.style.color = "#f59e0b";

				const systemPrompt = `あなたはプロのデザイン講師です。生徒が行ったデザイン分析やプレゼン内容のメモから、その「分析力・言語化能力・視点の鋭さ」を評価し、超簡潔な講師コメントを作成してください。

# 評価の指針
1. 「〜に取り組めていた（行動）」ではなく、「〜を分析できていた」「〜を言語化できていた（思考・表現）」という切り口で評価してください。
2. 具体的な固有名詞（赤、金、ラーメン、餃子等）は「配色」「主題」「コンセプト」といったデザイン用語に抽象化してください。
3. 発表内容から、生徒が「どこに注目して」「どう論理的に考えたか」を肯定的に記述してください。

# 厳守ルール
1. 【文字数】100文字以内、2〜3文で言い切ること。
2. 【報告禁止】「〜と言っていました」「〜と発表してくれた」は厳禁。すべて「〜を考察できていた」「〜の視点が鋭い」等の講師評価（プロの眼差し）に変換すること。
3. 【語尾】「〜できていました」「〜と言えます」など。

# 理想とするトーンの例
「デザインの意図を客観的に分析し、配色やフォントが与える視覚効果を的確に言語化できていました。全体のバランスを考慮した具体的な改善案を提示できており、視点が非常に論理的です。」
「主題の魅力を引き出すためのレイアウトについて、鋭い考察が見られました。ユーザー視点に立ったフォント選定や要素の配置など、目的を持ったデザイン設計を思考できています。」
「現状の課題を具体的に把握し、論理的な根拠を持って改善の方向性を提示できていました。UI/UXの観点から導線や要素の強弱を分析できており、説得力のある発表でした。」

# 出力形式
〈名前〉さん
\`\`\`
コメント本文
\`\`\``;
				async function tryGenerate(modelIndex) {
					if (modelIndex >= models.length) {
						statusLabel.innerText =
							"❌ 全てのモデルでエラーが発生しました。時間を置いてください。";
						return;
					}

					const currentModel = models[modelIndex];
					statusLabel.innerText = `⏳ 解析中... (${currentModel})`;

					return new Promise((resolve) => {
						GM_xmlhttpRequest({
							method: "POST",
							url: `https://generativelanguage.googleapis.com/v1/models/${currentModel}:generateContent?key=${API_KEY}`,
							headers: { "Content-Type": "application/json" },
							data: JSON.stringify({
								contents: [
									{
										parts: [
											{ text: `${systemPrompt}\n\n入力メモ：\n${memoText}` },
										],
									},
								],
							}),
							onload: async function (response) {
								if (response.status !== 200) {
									resolve(await tryGenerate(modelIndex + 1));
									return;
								}

								try {
									const data = JSON.parse(response.responseText);
									const aiText = data.candidates[0].content.parts[0].text;
									processResult(aiText);
									resolve();
								} catch (e) {
									statusLabel.innerText = "❌ データ処理エラー";
									resolve();
								}
							},
							onerror: async () => resolve(await tryGenerate(modelIndex + 1)),
						});
					});
				}

				function processResult(aiText) {
					// ``` で囲まれた部分をすべて抽出
					const regex = /```([\s\S]*?)```/g;
					let match;
					const comments = [];
					while ((match = regex.exec(aiText)) !== null) {
						comments.push(match[1].trim());
					}

					if (comments.length === 0) {
						statusLabel.innerText =
							"❌ コメントを抽出できませんでした。AIの回答形式を確認してください。";
						return;
					}

					// 入力先のテキストエリアをすべて取得 (data-field="comment" の中にあるもの)
					const textareas = Array.from(
						document.querySelectorAll('td[data-field="comment"] textarea'),
					);

					let successCount = 0;
					comments.forEach((comment, index) => {
						if (textareas[index]) {
							textareas[index].value = comment;
							textareas[index].dispatchEvent(
								new Event("input", { bubbles: true }),
							);
							textareas[index].dispatchEvent(
								new Event("change", { bubbles: true }),
							);
							textareas[index].style.backgroundColor = "#ecfdf5";
							successCount++;
						}
					});

					statusLabel.innerText = `✅ 上から順に ${successCount} 名の入力を完了しました。`;
					statusLabel.style.color = "#10b981";
				}

				await tryGenerate(0);
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
})();
