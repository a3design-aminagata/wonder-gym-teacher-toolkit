// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/common/visualizer/ui_toggles.js

(() => {
	// ===========================
	// Visualizer 設定
	// ===========================
	const KEY_HIDE_MATERIALS = "viz:hide_materials";
	const KEY_MATERIALS_TOGGLE = "t";
	const KEY_GO_TODAY = "g";
	const KEY_GO_COMMAND_CENTER = "s";
	const COMMAND_CENTER_URL = "file:///path/to/runner/command-center/index.html";

	const body = document.body;
	const btnMaterials = document.getElementById("toggle-materials");
	const btnGoToday = document.getElementById("go-today");
	const btnCommandCenter = document.getElementById("go-command-center");

	// 初期状態復元（教材リンクの表示・非表示のみ localStorage を使用）
	if (btnMaterials) {
		if (localStorage.getItem(KEY_HIDE_MATERIALS) === "1") {
			body.classList.add("viz-hide-materials");
		}
	}

	/**
	 * ボタン内にキーヒントとラベルを描画する
	 */
	const setBtn = (btn, key, label) => {
		if (!btn) return;
		btn.innerHTML = `
      <span class="viz-btn-key">${key.toUpperCase()}</span>
      <span class="viz-btn-label">${label}</span>
    `;
	};

	/**
	 * UIラベルの状態を同期する
	 */
	const syncLabels = () => {
		if (btnMaterials) {
			const isHide = body.classList.contains("viz-hide-materials");
			setBtn(
				btnMaterials,
				KEY_MATERIALS_TOGGLE,
				isHide ? "教材リンク OFF" : "教材リンク ON",
			);
		}

		if (btnGoToday) {
			setBtn(btnGoToday, KEY_GO_TODAY, "今日へ");
		}

		if (btnCommandCenter) {
			setBtn(btnCommandCenter, KEY_GO_COMMAND_CENTER, "Command Center");
		}
	};

	/**
	 * 教材リンクの表示・非表示を切り替え、今日へスクロールする
	 */
	const toggleMaterials = () => {
		body.classList.toggle("viz-hide-materials");
		localStorage.setItem(
			KEY_HIDE_MATERIALS,
			body.classList.contains("viz-hide-materials") ? "1" : "0",
		);
		syncLabels();
		// 切り替え後に位置を調整
		window.VIZ?.scrollToToday?.();
	};

	// --- イベントリスナー登録 ---

	if (btnMaterials) {
		btnMaterials.addEventListener("click", toggleMaterials);
	}

	if (btnGoToday) {
		btnGoToday.addEventListener("click", () => {
			window.VIZ?.scrollToToday?.();
		});
	}

	if (btnCommandCenter) {
		btnCommandCenter.addEventListener("click", async () => {
			await window.VIZ?.openInDefaultProfile?.(COMMAND_CENTER_URL);
		});
	}

	// 初期表示時のラベル設定
	syncLabels();

	// キーボードショートカット
	document.addEventListener("keydown", (e) => {
		// 入力フォーム等では無効化
		const el = e.target;
		if (
			el &&
			(el.tagName === "INPUT" ||
				el.tagName === "TEXTAREA" ||
				el.isContentEditable)
		) {
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;

		const key = e.key.toLowerCase();

		// t: 教材 ON/OFF
		if (key === KEY_MATERIALS_TOGGLE && btnMaterials) {
			e.preventDefault();
			toggleMaterials();
		}

		// g: 今日へ
		else if (key === KEY_GO_TODAY && window.VIZ?.scrollToToday) {
			e.preventDefault();
			window.VIZ.scrollToToday();
		}

		// s: Command Center
		else if (key === KEY_GO_COMMAND_CENTER) {
			e.preventDefault();
			window.VIZ?.openInDefaultProfile?.(COMMAND_CENTER_URL);
		}

	});
})();

// ===========================
// グローバルユーティリティ (window.VIZ)
// ===========================
window.VIZ = window.VIZ || {};

/**
 * Appleショートカットを実行する
 */
function runShortcutWithUrl(name, urlToOpen) {
	const encodedName = encodeURIComponent(name);
	const encodedUrl = encodeURIComponent(urlToOpen);
	const u = `shortcuts://run-shortcut?name=${encodedName}&input=text&text=${encodedUrl}`;
	const opened = window.open(u, "_blank");
	if (!opened) {
		location.href = u;
	}
}

/**
 * URLを直接渡して指定のショートカットを実行する
 */
window.VIZ.openInDefaultProfile = async function (url) {
	runShortcutWithUrl("Default", url);
};
