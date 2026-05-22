// ==UserScript==
// @name         Googleフォーム AI相談用プロンプト作成
// @namespace    https://github.com/a3design-aminagata/
// @version      1.2
// @description  フォームの項目を抽出し、AIに相談するためのプロンプトをクリップボードにコピーします
// @author       Ami Nagata
// @match        https://docs.google.com/forms/d/e/*/viewform*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    const EXCLUDED_FORM_IDS_KEY = 'excludedFormIds';

    function getCurrentFormId() {
        const match = window.location.pathname.match(/\/forms\/d\/e\/([^/]+)\//i);
        return match?.[1] ? match[1].toLowerCase() : '';
    }

    function normalizeFormIdList(values) {
        if (!Array.isArray(values)) return [];
        return values
            .map((v) => String(v || '').trim().toLowerCase())
            .filter(Boolean);
    }

    function loadExcludedFormIds() {
        const raw = GM_getValue(EXCLUDED_FORM_IDS_KEY, []);
        if (typeof raw === 'string') {
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
        alert('このフォームを除外リストに追加しました。ページを再読み込みしてください。');
    }

    function unexcludeCurrentForm(currentFormId) {
        if (!currentFormId) return;
        const ids = loadExcludedFormIds().filter((id) => id !== currentFormId);
        saveExcludedFormIds(ids);
        alert('このフォームを除外リストから解除しました。ページを再読み込みしてください。');
    }

    function showExcludedForms() {
        const ids = loadExcludedFormIds();
        if (ids.length === 0) {
            alert('除外フォームは登録されていません。');
            return;
        }
        alert(`除外フォームID一覧:\n${ids.join('\n')}`);
    }

    const currentFormId = getCurrentFormId();
    const isCurrentFormExcluded =
        Boolean(currentFormId) && loadExcludedFormIds().includes(currentFormId);

    if (currentFormId) {
        if (isCurrentFormExcluded) {
            GM_registerMenuCommand('このフォームを除外から解除', () =>
                unexcludeCurrentForm(currentFormId),
            );
        } else {
            GM_registerMenuCommand('このフォームを除外に追加', () =>
                excludeCurrentForm(currentFormId),
            );
        }
    }
    GM_registerMenuCommand('除外フォーム一覧を表示', showExcludedForms);

    if (isCurrentFormExcluded) {
        return;
    }

    // 画面の左下にボタンを追加する
    function createCopyButton() {
        const btn = document.createElement("button");
        btn.textContent = "🤖 AIに相談 (コピー)";

        // フォームの邪魔にならない左下に固定配置（右下は名前変更ボタンがある想定）
        btn.style.position = "fixed";
        btn.style.bottom = "20px";
        btn.style.right = "20px";
        btn.style.padding = "10px 15px";
        btn.style.backgroundColor = "#4285f4"; // ちょっと目立つGoogleブルー
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.borderRadius = "20px";
        btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
        btn.style.cursor = "pointer";
        btn.style.zIndex = "9999";
        btn.style.fontFamily = "sans-serif";
        btn.style.fontSize = "14px";
        btn.style.fontWeight = "bold";
        btn.style.transition = "background-color 0.2s, transform 0.1s";

        // マウスホバーとクリック時のアニメーション
        btn.onmouseover = () => btn.style.backgroundColor = "#3367d6";
        btn.onmouseout = () => btn.style.backgroundColor = "#4285f4";
        btn.onmousedown = () => btn.style.transform = "scale(0.95)";
        btn.onmouseup = () => btn.style.transform = "scale(1)";

        btn.onclick = (e) => {
            e.preventDefault();
            generateAndCopyPrompt();
        };

        document.body.appendChild(btn);
    }

    // 項目を抽出してプロンプトを作成・コピーする関数
    function generateAndCopyPrompt() {
        // AIに渡すベースとなる定型文
        let promptText = "以下のGoogleフォームの入力項目について、どのように回答すればよいかアドバイスや例文を教えてください。\n\n【フォームの項目】\n";

        const questionBlocks = document.querySelectorAll('.geS5n');

        questionBlocks.forEach(block => {
            const titleEl = block.querySelector('.M7eMe');
            if (!titleEl) return;

            let title = titleEl.textContent.trim();

            // 名前の質問はAIへの相談から除外
            if (title.includes('名前') || title.includes('お名前')) {
                return; // スキップ
            }

            // 必須マークの「*」を綺麗に取り除く
            title = title.replace(/\*$/, '').trim();

            promptText += `・${title}\n`;

            // AIが回答しやすいように、選択肢（ラジオボタンやチェックボックス）がある場合はそれも取得する
            const options = block.querySelectorAll('.aDTYNe');
            if (options.length > 0) {
                options.forEach(opt => {
                    const optText = opt.textContent.trim();
                    if (optText && optText !== "その他:") {
                        promptText += `  - ${optText}\n`;
                    }
                });
            }
        });

        // 最後に自分が書き込める欄を追加
        promptText += "\n【私の状況・追加で聞きたいこと】\n（※ここにあなたの状況や、回答する上での制約、AIに考慮してほしいことを書いてください）\n";

        // Tampermonkeyの機能を使ってクリップボードにコピー
        GM_setClipboard(promptText);

        // コピー完了を通知（改行も表示できるようにinnerTextを使用）
        showToast("AI用プロンプトをコピーしました！\nChatGPTなどに貼り付けてください。");
    }

    // トースト通知
    function showToast(message) {
        const existingToast = document.getElementById("ai-toast");
        if (existingToast) existingToast.remove();

        const toast = document.createElement("div");
        toast.id = "ai-toast";
        toast.innerText = message;
        toast.style.position = "fixed";
        toast.style.bottom = "70px"; // ボタンの少し上に表示
        toast.style.left = "20px";
        toast.style.backgroundColor = "#323232";
        toast.style.color = "#fff";
        toast.style.padding = "12px 16px";
        toast.style.borderRadius = "8px";
        toast.style.zIndex = "9999";
        toast.style.fontSize = "14px";
        toast.style.lineHeight = "1.5";
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        toast.style.pointerEvents = "none";

        document.body.appendChild(toast);

        // ふわっと表示して3秒後に消す
        setTimeout(() => { toast.style.opacity = "1"; }, 10);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ページ読み込み完了後にボタンを設置
    window.addEventListener('load', () => {
        setTimeout(createCopyButton, 500);
    });

})();
