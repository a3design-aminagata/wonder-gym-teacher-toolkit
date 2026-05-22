// ==UserScript==
// @name         LMS : online_lessons - 不参加select変更でSlack文生成
// @namespace    https://github.com/a3design-aminagata/
// @version      1.8
// @description  不参加・遅刻の状態に合わせてSlack報告文を生成。投稿先を通常授業と振替授業で出し分けます。
// @match        https://wonder-gym.jp/*/edit
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	"use strict";

	console.log("[TM] 不参加・遅刻 Slack監視スクリプト読み込み完了");

	// =====================
	// UIパネルの生成
	// =====================
	const panelHTML = `
  <style>
    @media (max-width: 1100px) {
      #auto-slack-msg { top: 150px !important; }
    }
    @media (min-width: 1100px) {
      #auto-slack-msg {
        right: auto;
        left: 20px !important;
        width: 220px !important;
      }
    }
  </style>

  <div id="auto-slack-msg"
       style="
         position: fixed;
         top: 70px;
         right: 20px;
         width: 320px;
         max-height: 80vh;
         overflow-y: auto;
         background: #fff;
         border: 2px solid #ef4444;
         border-radius: 10px;
         padding: 16px;
         box-shadow: 0 4px 12px rgba(0,0,0,0.15);
         z-index: 99999;
         display: none;
       ">
    <h3 id="slack-post-target" style="font-weight:bold; margin-bottom:12px; font-size:14px;">【投稿先：Slack #00_デザイナーall】</h3>
    <div class="content">
      <div style="margin-bottom:16px;">
        <p style="font-size:13px; font-weight:bold; margin-bottom:4px;">タイトル</p>
        <pre id="slack-title" style="font-size:12px; background:#f5f5f5; padding:10px; border-radius:4px; white-space:pre-wrap;"></pre>
        <button id="copy-title-btn"
          style="margin-top:6px; padding:6px 12px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer;">
          コピー
        </button>
      </div>

      <div style="margin-bottom:16px;">
        <p style="font-size:13px; font-weight:bold; margin-bottom:4px;">本文</p>
        <pre id="slack-body"
             style="font-size:12px; background:#f5f5f5; padding:10px; border-radius:4px; white-space:pre-wrap;"></pre>
        <button id="copy-body-btn"
          style="margin-top:6px; padding:6px 12px; background:#10b981; color:#fff; border:none; border-radius:4px; cursor:pointer;">
          コピー
        </button>
      </div>
    </div>
  </div>
  `;

	document.body.insertAdjacentHTML("beforeend", panelHTML);

	const panel = document.querySelector("#auto-slack-msg");
	const preTitle = document.querySelector("#slack-title");
	const preBody = document.querySelector("#slack-body");
	const postTarget = document.querySelector("#slack-post-target");

	// 位置制御
	const baseTop = 70;
	function updatePanelPosition() {
		if (!panel || panel.style.display === "none") return;
		const y = window.scrollY || window.pageYOffset;
		if (y >= 150) {
			panel.style.position = "fixed";
			panel.style.top = baseTop + "px";
		} else if (y >= 200) {
			const delta = y - 150;
			panel.style.position = "absolute";
			panel.style.top = baseTop + delta + "px";
		} else {
			panel.style.position = "fixed";
			panel.style.top = baseTop + 200 + "px";
		}
	}
	window.addEventListener("scroll", updatePanelPosition, { passive: true });
	window.addEventListener("resize", updatePanelPosition);

	// コピー＆トースト
	const toast = (msg) => {
		const t = document.createElement("div");
		t.textContent = msg;
		t.style =
			"position:fixed; bottom:20px; right:20px; background:#333; color:#fff; padding:10px 16px; border-radius:6px; opacity:0; transition:opacity .3s; z-index:999999;";
		document.body.appendChild(t);
		requestAnimationFrame(() => (t.style.opacity = "1"));
		setTimeout(() => {
			t.style.opacity = "0";
			setTimeout(() => t.remove(), 300);
		}, 1200);
	};

	document.addEventListener("click", (e) => {
		if (e.target.id === "copy-title-btn") {
			navigator.clipboard.writeText(preTitle.innerText);
			toast("タイトルをコピーしました");
		}
		if (e.target.id === "copy-body-btn") {
			navigator.clipboard.writeText(preBody.innerText);
			toast("本文をコピーしました");
		}
	});

	// =====================
	// メインロジック
	// =====================
	const selects = document.querySelectorAll('select[name$="[is_attended]"]');

	const updateMessage = () => {
		const absentMembers = [];
		const lateMembers = [];

		selects.forEach((sel) => {
			const row = sel.closest("tr");
			const status = row.getAttribute("data-attendance-status");

			// 名前取得のロジック（漢字フィールド）
			const studentTd = row.querySelector('td[data-field="student"]');
			if (!studentTd) return;
			const name = studentTd.childNodes[0].textContent.trim();

			if (status === "absent" || sel.value === "0") {
				absentMembers.push(name);
			} else if (status === "late") {
				lateMembers.push(name);
			}
		});

		if (absentMembers.length === 0 && lateMembers.length === 0) {
			panel.style.display = "none";
			return;
		}

		// 支部名・日時・振替判定の取得
		const branchLabel = Array.from(
			document.querySelectorAll("p.font-bold"),
		).find((p) => p.textContent.includes("支部名"));
		const branch = branchLabel
			? branchLabel.nextElementSibling.textContent.trim()
			: "（支部名不明）";
		const pureBranch = branch.match(/【(.+?)】/)?.[1] || "（支部不明）";
		const dateLabel = Array.from(document.querySelectorAll("p.font-bold")).find(
			(p) => p.textContent.includes("開始日時"),
		);
		const datetime = dateLabel
			? dateLabel.nextElementSibling.textContent.trim()
			: "（開始日時不明）";
		const isMakeUpClass = Boolean(
			document.querySelector('input[name="is_make_up_class"][value="1"]'),
		);

		// 言葉の出し分け
		let typeTitle = "";
		let typeBody = "";

		if (absentMembers.length > 0 && lateMembers.length > 0) {
			typeTitle = "遅刻・不参加";
			typeBody = "欠席・遅刻";
		} else if (absentMembers.length > 0) {
			typeTitle = "不参加";
			typeBody = "欠席";
		} else {
			typeTitle = "遅刻";
			typeBody = "遅刻";
		}

		// ---------------------
		// 投稿先の出し分け
		// ---------------------
		postTarget.textContent = isMakeUpClass
			? "【投稿先：Slack #00_デザイナーall】"
			: "【投稿先：Slack #00_デザイナーall】";

		// タイトル生成
		const allNames = [...absentMembers, ...lateMembers].join("、");

		if (isMakeUpClass) {
			preTitle.textContent = `【振替授業の${typeBody}報告：${allNames}さん】`;
		} else {
			preTitle.textContent = `【受講生${typeTitle}のご報告】`;
		}

		// 本文生成
		let introText = isMakeUpClass
			? `振替授業の${typeBody}が発生したため報告させて頂きます。`
			: `${typeBody}が発生したため報告させて頂きます。`;

		let body = `お世話になっております。
${introText}

${branch}
・${datetime}
`;

		absentMembers.forEach((name) => {
			body += `
・${name}さん
　- 欠席（不参加扱い）
`;
		});

		lateMembers.forEach((name) => {
			body += `
・${name}さん
　- ○分遅刻（参加扱い）
　- 途中で2回ほど短い退出・再入室があった
`;
		});

		body += `
${pureBranch}支部担当者へ`;

		preBody.textContent = body;
		panel.style.display = "block";
		updatePanelPosition();
	};

	selects.forEach((sel) => {
		sel.addEventListener("change", updateMessage);
	});
})();
