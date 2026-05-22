// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/notion/internal/actions/notionActions.js
// ---------- .env 読み込み（親階層）----------
import { loadParentEnv } from "../../../common/loadEnv.js";
loadParentEnv(import.meta.url);
// -------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function clickToggle(
	page,
	text,
	{ timeoutMs = 0, pollMs = 250, logEveryMs = 5000 } = {},
) {
	const forever = timeoutMs <= 0;
	const start = Date.now();
	let nextProgressAt = start + logEveryMs;

	console.log(
		`🔎 トグル「${text}」を探しています...${forever ? "（見つかるまで待機）" : ""}`,
	);

	while (true) {
		if (page.isClosed?.()) {
			console.log(`❌ トグル「${text}」探索中にページが閉じました`);
			return false;
		}

		let opened = false;
		try {
			opened = await page.evaluate((toggleText) => {
				const toggles = Array.from(
					document.querySelectorAll("div.notion-toggle-block"),
				);
				for (const toggle of toggles) {
					if ((toggle.innerText || "").includes(toggleText)) {
						const btn = toggle.querySelector("div[role='button']");
						if (btn) {
							btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
							return true;
						}
					}
				}
				return false;
			}, text);
		} catch {
			// Notion 側の描画切替中に context が崩れる場合があるため、次ループで再試行する
		}

		if (opened) {
			console.log(`✅ トグル「${text}」を開きました`);
			return true;
		}

		const now = Date.now();
		if (!forever && now - start >= timeoutMs) {
			console.log(`❌ トグル「${text}」が見つかりませんでした`);
			return false;
		}

		if (now >= nextProgressAt) {
			const elapsedSec = Math.floor((now - start) / 1000);
			console.log(`⏳ トグル「${text}」待機中... (${elapsedSec}s)`);
			nextProgressAt = now + logEveryMs;
		}

		await sleep(pollMs);
	}
}

export async function loadMore(page) {
	let count = 0;

	while (true) {
		const clicked = await page.evaluate(() => {
			const btns = Array.from(
				document.querySelectorAll("button, [role='button']"),
			);
			for (const b of btns) {
				const txt = (b.innerText || "").trim();
				if (txt.includes("さらに読み込む")) {
					b.click();
					return true;
				}
			}
			return false;
		});

		if (!clicked) break;

		count++;
		console.log(`🔁 Load more (${count})`);
		await sleep(1200);
	}

	console.log("✅ 全講師読み込み完了");
}

/**
 * クリック対象の timeline item（バー）を返す
 */
export async function extractVisibleCards(page) {
	console.log("🔍 タイムラインカード (.notion-timeline-item) を取得します…");

	const cardHandles = await page.$$(".notion-timeline-item");

	console.log(`📌 カード数: ${cardHandles.length}`);
	return cardHandles;
}

/**
 * 👇 君がアップした DOM に基づいて作った
 * タイムラインに見えているテキストの解析版
 */
export async function extractTimelineCards(page) {
	const baseUrl = (
		process.env.NOTION_BASE_URL || "https://YOUR_NOTION_WORKSPACE.notion.site"
	)
		.trim()
		.replace(/\/+$/, "");

	return await page.evaluate((BASE) => {
		const rows = [...document.querySelectorAll(".notion-timeline-item-row")];

		return rows
			.map((row) => {
				// ▼ クリック用のタイムラインバー
				const item = row.querySelector(".notion-timeline-item");
				const link = item?.querySelector("a[href]");
				let pageUrl = "";

				if (link) {
					const raw = link.getAttribute("href"); // 例 /3-18-xxxx?pvs=25
					if (raw) {
						// ?以降カットして Notion 公開 URL にする
						const clean = raw.split("?")[0];
						pageUrl = BASE + clean;
					}
				}

				// ▼ 表示テキスト部分
				const props = row.querySelector(".notion-timeline-item-properties");
				if (!props) return null;

				const spans = [...props.querySelectorAll("span")];

				const course = spans[0]?.innerText.trim() || "";
				const datetime = spans[1]?.innerText.trim() || "";
				const count = spans[2]?.innerText.trim() || "";
				const dayLabel = spans[3]?.innerText.trim() || "";

				return {
					course,
					datetime,
					count,
					dayLabel,
					pageUrl, // ← URL
					raw: props.innerText.trim(),
				};
			})
			.filter(Boolean);
	}, baseUrl);
}
/**
 * 授業詳細ページを開いて、必要な情報を JSON に抽出する
 */
export async function extractDetailPage(page, url) {
	console.log(`🌐 詳細ページを取得: ${url}`);

	await page.goto(url, { waitUntil: "networkidle2" });

	await new Promise((resolve) => setTimeout(resolve, 1500));

	// ページタイトル（h1 不在ページでも落とさない）
	const title = await page.evaluate(() => {
		const h1 = document.querySelector("h1");
		if (h1?.innerText?.trim()) return h1.innerText.trim();

		const heading = document.querySelector('[role="heading"]');
		if (heading?.innerText?.trim()) return heading.innerText.trim();

		const docTitle = (document.title || "").trim();
		return docTitle.replace(/\s*\|\s*Notion.*$/i, "").trim();
	});

	// 日付（見つからない場合は空文字）
	const date = await page.evaluate(() => {
		const el = document.querySelector('div[role="row"] div div');
		return el?.innerText?.trim() || "";
	});

	// 全ての span を取得
	const spans = await page.$$eval("span", (els) =>
		els.map((e) => e.innerText.trim()),
	);

	// 資料URL
	const links = await page.$$eval("a", (els) =>
		els
			.filter((a) => a.href && a.innerText.trim() !== "")
			.map((a) => ({
				text: a.innerText.trim(),
				url: a.href,
			})),
	);

	// 主要情報の抽出
	const TARGET_TEACHER = (process.env.NAME || "").trim();

	const course = spans.find((s) => s.includes("月")) || "";
	const count = spans.find((s) => s.includes("回目")) || "";
	const teacher = TARGET_TEACHER
		? spans.find((s) => s.includes(TARGET_TEACHER)) || ""
		: "";
	const status = spans.find((s) => ["未着手", "完了"].includes(s)) || "";
	const type =
		spans.find((s) => ["対面授業", "オンライン", "動画授業"].includes(s)) || "";
	const timeLabel =
		spans.find((s) => s.includes("曜") && s.includes(":")) || "";
	const company =
		spans.find((s) => s.includes("株式会社") || s.includes("合同会社")) || "";

	return {
		title,
		date,
		course,
		count,
		teacher,
		status,
		type,
		timeLabel,
		company,
		links,
		pageUrl: url,
	};
}
export async function clickDateFilterPill(page) {
	console.log("🔍 日付フィルタ pill を探しています…");

	const clicked = await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll('div[role="button"]'));

		for (const btn of btns) {
			const raw = btn.innerText || "";

			// 改行・スペース除去して比較
			const t = raw.replace(/\s/g, "");

			if (t.includes("日付:今後2か月間")) {
				btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
				return true;
			}
		}
		return false;
	});

	if (clicked) console.log("✅ 日付フィルタ pill をクリックしました");
	else console.log("❌ 日付フィルタ pill が見つかりませんでした");

	return clicked;
}
