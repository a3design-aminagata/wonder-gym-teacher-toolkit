// material_notion_map.js
// 特定の資料リンクに対応する Notion ページを紐づける

const MATERIAL_NOTION_MAP = [
	{
		match: (text) => typeof text === "string" && text.includes("04.言語化ワーク＜バナー①＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_01",
	},
	{
		match: (text) => typeof text === "string" && text.includes("08.言語化ワーク＜バナー③＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_02",
	},
	{
		match:
			(text) =>
				typeof text === "string" &&
				text.includes("02.デザインTips＜デザインの種類と画像素材サイト＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_03",
	},
	{
		match: (text) => typeof text === "string" && text.includes("04.デザインTips＜トンマナ＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_04",
	},
	{
		match: (text) => typeof text === "string" && text.includes("17.質問＆相談会"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_05",
	},
	{
		match: (text) => typeof text === "string" && text.includes("VSC実技"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_06",
	},
	{
		match:
			(text) =>
				typeof text === "string" &&
				text.includes("17.言語化ワーク＜ポートフォリオサイト＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_07",
	},
	{
		match: (text) => typeof text === "string" && text.includes("08.デザインTips＜フォント＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_08",
	},
	{
		match: (text) => typeof text === "string" && text.includes("11.言語化ワーク＜LPファーストビュー＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_09",
	},
	{
		match: (text) => typeof text === "string" && text.includes("14.言語化ワーク＜Webサイト①＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_10",
	},
	{
		match: (text) => typeof text === "string" && text.includes("15.言語化ワーク＜Webサイト②＞"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_11",
	},
	{
		match: (text) => typeof text === "string" && text.includes("最終回資料"),
		notionUrl: "https://www.notion.so/YOUR_MATERIAL_PAGE_ID_12",
	},
	// 追加したい場合は上記形式でエントリを増やす
];

export function findNotionUrlForMaterial(text) {
	if (!text) return null;
	const hit = MATERIAL_NOTION_MAP.find((m) => m.match(text));
	return hit?.notionUrl || null;
}
