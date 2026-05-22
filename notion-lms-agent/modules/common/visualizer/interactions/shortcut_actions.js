// shortcut_actions.js - 実際に手を動かす（コピー・実行）職人

/**
 * クリップボードにコピー（他用途で使用するため残す）
 */
export async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		window.prompt("コピーしてください:", text);
		return false;
	}
}

/**
 * ショートカットにURL文字列を直接渡して起動
 */
export function runShortcutWithUrl(name, urlToOpen) {
	const u = `shortcuts://run-shortcut?name=${encodeURIComponent(
		name,
	)}&input=text&text=${encodeURIComponent(urlToOpen)}`;
	const opened = window.open(u, "_blank");
	// ポップアップブロックなどで失敗した場合はフォールバックで遷移
	if (!opened) {
		window.location.href = u;
	}
}

/**
 * 指定のプロフィールでURLを開く（クリップボードを汚さない）
 */
export async function openWithProfile(url, profileName) {
	runShortcutWithUrl(profileName, url);
}

/**
 * 任意のテキスト（複数コマンド等）を PasteCommand などのショートカットに送る
 */
export function runPasteCommand(commandText, shortcutName = "PasteCommand") {
	if (!commandText) return;
	runShortcutWithUrl(shortcutName, commandText);
}
