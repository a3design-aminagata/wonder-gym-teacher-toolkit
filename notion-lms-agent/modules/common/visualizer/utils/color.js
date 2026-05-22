// label ごとの色割当（キーから安定して決める：hash方式）
const COLOR_MAX = 6; // item_block.css の color-0.. の定義数に合わせる

export function hashStringToInt(str) {
	let h = 0;
	for (let i = 0; i < str.length; i++) {
		h = (h * 31 + str.charCodeAt(i)) >>> 0;
	}
	return h;
}

export function getColorClassForKey(key) {
	if (!key) return "";
	const idx = hashStringToInt(String(key)) % COLOR_MAX;
	return `color-${idx}`;
}
