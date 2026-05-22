// material_p5_map.js
// 特定の資料リンクで P5 プロファイルで開きたいローカル/別URLを紐づける

const MATERIAL_P5_MAP = [
	{
		match: (text) =>
			typeof text === "string" && text.includes("11.デザインTips＜HTML/CSS＞"),
		url: "file:///path/to/wonder-gym-tips/html_css/index.html",
	},
	{
		match: (text) =>
			typeof text === "string" &&
			text.includes("13.デザインTips＜Webデザイナー専門用語＞"),
		url: "file:///path/to/wonder-gym-tips/web-designer-glossary/index.html",
	},
	// 追加する場合は同形式でエントリを増やす
];

export function findP5UrlForMaterial(text) {
	if (!text) return null;
	const hit = MATERIAL_P5_MAP.find((m) => m.match(text));
	return hit?.url || null;
}
