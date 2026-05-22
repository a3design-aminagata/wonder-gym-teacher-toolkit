// link_tracker.js - リンクの訪問状態を管理するモジュール

const STORAGE_KEY = "viz:visited_links";

/**
 * 訪問済みURLのリストを取得する
 */
function getVisitedLinks() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
	} catch (e) {
		return [];
	}
}

/**
 * URLを訪問済みとして保存する
 */
export function markAsVisited(url) {
	const visited = getVisitedLinks();
	if (!visited.includes(url)) {
		visited.push(url);
		// 溜まりすぎないよう、最新の1000件だけに絞る（任意）
		const limited = visited.slice(-1000);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
	}
}

/**
 * 画面上のすべてのリンクをチェックして、訪問済みクラスを付ける
 */
export function applyVisitedStyles() {
	const visited = getVisitedLinks();
	const links = document.querySelectorAll(".status-link");

	links.forEach((a) => {
		if (visited.includes(a.href)) {
			a.classList.add("is-visited");
		}
	});
}
