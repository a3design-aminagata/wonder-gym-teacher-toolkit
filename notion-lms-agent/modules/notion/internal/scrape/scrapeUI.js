// modules/notion/scrape/schedule/internal/scrape/scrapeUI.js

/**
 * ページに「日付レンジ」ボタンがあるかどうかを返す
 * @param {import('puppeteer').Page} page
 * @returns {Promise<boolean>}
 */
export async function hasDateRangeUI(page) {
	try {
		const handle = await page.evaluateHandle(() => {
			return (
				[...document.querySelectorAll('div[role="button"]')].find(
					(b) =>
						(b.innerText || "").includes("日付") &&
						(b.innerText || "").includes("→"),
				) || null
			);
		});

		const el = handle.asElement();
		return !!el;
	} catch (err) {
		return false;
	}
}
