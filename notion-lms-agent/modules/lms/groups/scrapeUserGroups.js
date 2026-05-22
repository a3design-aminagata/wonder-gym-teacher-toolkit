// modules/lms/scrapeUserGroups.js

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { wait } from "../../common/wait.js";
import { attachLmsListUrlTo } from "./attachLmsListUrl.js";
import { openLmsSession } from "../auth/loginLms.js";

// パス計算まわり ------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// notion-lms-agent/
const projectRoot = path.resolve(__dirname, "..", "..", "..");
// data/
const dataDir = path.join(projectRoot, "data");
const defaultOutPath = path.join(dataDir, "courses_with_group_ids.json");

function getCoursesWithUrlsPath(inputDir) {
	return path.join(inputDir, "courses_with_urls.json");
}

// -----------------------------------------------------
// コア：スクレイピングして results を返すだけ
// -----------------------------------------------------
async function scrapeUserGroupsCore(inputDir = dataDir) {
	console.log("🚀 user_groups ID スクレイピング開始…");

	const coursesWithUrlsPath = getCoursesWithUrlsPath(inputDir);

	if (!fs.existsSync(coursesWithUrlsPath)) {
		throw new Error(
			`courses_with_urls.json が存在しません: ${coursesWithUrlsPath}`,
		);
	}

	const raw = fs.readFileSync(coursesWithUrlsPath, "utf-8");
	const courses = JSON.parse(raw);

	const { browser, page } = await openLmsSession();
	const results = [];

	for (const course of courses) {
		console.log(`\n📌 ${course.courseKey}`);
		console.log(`🔗 ${course.lmsListUrl}`);

		await page.goto(course.lmsListUrl, { waitUntil: "networkidle2" });
		await wait(1200);

		const ids = await page.evaluate((category) => {
			const table = document.querySelector("table");
			const headerCells = table
				? Array.from(table.querySelectorAll("thead th")).map((th) =>
						(th.textContent || "").replace(/\s+/g, " ").trim(),
					)
				: [];
			const usersCol = headerCells.findIndex((t) => t.includes("ユーザー数"));
			const faceToFaceCol = headerCells.findIndex((t) => t.includes("対面指導数"));
			const participantsCol = headerCells.findIndex((t) =>
				t.includes("参加受講生数"),
			);

			const parseCount = (v) => {
				const n = Number(String(v || "").replace(/[^\d.-]/g, ""));
				return Number.isFinite(n) ? n : null;
			};

			const rows = Array.from(document.querySelectorAll("table tbody tr"));

			const groups = rows
				.map((tr) => {
					const tds = tr.querySelectorAll("td");
					if (tds.length < 2) return null;

					const name = tds[1].textContent?.trim() || "";
					const link = tr.querySelector('a[href*="/user_groups/"]');
					if (!link) return null;

					const m = link.href.match(/user_groups\/(\d+)/);
					if (!m) return null;

					const yearMatch = name.match(/(20\d{2})年/);
					const year = yearMatch ? Number(yearMatch[1]) : 0;
					const users = usersCol >= 0 ? parseCount(tds[usersCol]?.textContent) : null;
					const faceToFace =
						faceToFaceCol >= 0 ? parseCount(tds[faceToFaceCol]?.textContent) : null;
					const participants =
						participantsCol >= 0
							? parseCount(tds[participantsCol]?.textContent)
							: null;
					const stats = [users, faceToFace, participants].filter((v) => v !== null);
					const isAllZeroStats = stats.length === 3 && stats.every((v) => v === 0);

					return {
						name,
						id: m[1],
						year,
						isAllZeroStats,
					};
				})
				.filter(Boolean);

			const validByStats = groups.filter((g) => !g.isAllZeroStats);
			const selectableGroups = validByStats.length ? validByStats : groups;

			// 1️⃣ 1件しかない → 無条件採用
			if (selectableGroups.length === 1) {
				return [selectableGroups[0].id];
			}

			// 2️⃣ category でフィルタ
			const filteredByCategory = selectableGroups.filter((g) =>
				g.name.includes(category),
			);

			if (filteredByCategory.length === 1) {
				return [filteredByCategory[0].id];
			}
			if (filteredByCategory.length > 1) {
				const sortedByYearDesc = [...filteredByCategory].sort(
					(a, b) => b.year - a.year,
				);
				return [sortedByYearDesc[0].id];
			}

			// 3️⃣ 年が一番新しいものを採用
			const sortedByYearDesc = [...selectableGroups].sort(
				(a, b) => b.year - a.year,
			);

			if (sortedByYearDesc.length > 0) {
				return [sortedByYearDesc[0].id];
			}

			return [];
		}, course.category);

		if (ids.length === 0) {
			console.warn(
				`⚠ userGroupId not found: ${course.courseKey} (${course.category})`,
			);
		}

		if (ids.length > 1) {
			console.warn(`⚠ multiple userGroupIds found: ${course.courseKey}`, ids);
		}

		results.push({
			courseKey: course.courseKey,
			month: course.month,
			area: course.area,
			category: course.category,
			lmsListUrl: course.lmsListUrl,
			userGroupIds: ids,
		});

		await wait(500);
	}

	await browser.close();
	return results;
}

// -----------------------------------------------------
// 任意の場所・名前で書き出す関数
// -----------------------------------------------------
export async function scrapeUserGroupsTo(
	outDir,
	fileName = "courses_with_group_ids.json",
	inputDir = dataDir,
) {
	const results = await scrapeUserGroupsCore(inputDir);

	if (!fs.existsSync(outDir)) {
		fs.mkdirSync(outDir, { recursive: true });
	}

	const outPath = path.join(outDir, fileName);
	fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

	console.log(`🎉 user_group_ids を出力しました → ${outPath}`);
	return { outPath, count: results.length };
}

// -----------------------------------------------------
// デフォルト（引数なし実行） → data/ 配下だけに書き出す（1か所）
// -----------------------------------------------------
export async function scrapeUserGroupsDefault() {
	return scrapeUserGroupsTo(dataDir, "courses_with_group_ids.json", dataDir);
}

// -----------------------------------------------------
// CLI 実行
//   node modules/lms/scrapeUserGroups.js
// → data/ にだけ出力（安全・従来どおり）
//
//   node modules/lms/scrapeUserGroups.js ./apply-message-maker/data
// → apply-message-maker/data/ に出力
//
//   node modules/lms/scrapeUserGroups.js ./visualizer_schedule/data my.json
// → 好きな名前で出力
// -----------------------------------------------------
// -----------------------------------------------------
// CLI 実行
//   node modules/lms/scrapeUserGroups.js
//   node modules/lms/scrapeUserGroups.js apply-message-maker/data --from=available
// -----------------------------------------------------
const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
	(async () => {
		const args = process.argv.slice(2);

		// flags
		const fromAvailable = args.includes("--from=available");

		// positional args only
		const positional = args.filter((a) => !a.startsWith("--"));

		if (positional.length === 0) {
			// デフォルト：data/ を input/output にして schedules から作る（安全）
			await attachLmsListUrlTo(dataDir, "courses_with_urls.json", {
				mode: "schedules",
			});
			await scrapeUserGroupsTo(dataDir, "courses_with_group_ids.json", dataDir);
			process.exit(0);
		}

		// 引数あり：outDir を入出力元として完結させる
		const outDir = path.resolve(process.cwd(), positional[0]);
		const fileName = positional[1] || "courses_with_group_ids.json";

		// outDir の入力で courses_with_urls.json を作る
		await attachLmsListUrlTo(outDir, "courses_with_urls.json", {
			mode: fromAvailable ? "available" : "schedules",
		});

		console.log("=== DEBUG: start scraping ===");
		const r = await scrapeUserGroupsTo(outDir, fileName, outDir);
		console.log("=== DEBUG: done scraping ===", r);

		process.exit(0);
	})().catch((e) => {
		console.error("❌ エラー:", e);
		process.exit(1);
	});
}
