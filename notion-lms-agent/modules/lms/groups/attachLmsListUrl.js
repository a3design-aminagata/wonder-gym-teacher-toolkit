// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/lms/groups/attachLmsListUrl.js

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { LMS_USER_GROUPS_URL } from "../constants.js";

// --------------------
// パス解決
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// notion-lms-agent/
const projectRoot = path.resolve(__dirname, "..", "..", "..");

// notion-lms-agent/data/
const dataDir = path.join(projectRoot, "data");

// デフォルト入力
const schedulesPath = path.join(dataDir, "schedules.json");

function makeLmsListUrl({ month, area }) {
	return `${LMS_USER_GROUPS_URL}?prefecture=${encodeURIComponent(area)}&year=&month=${month}`;
}

// --------------------
// Core(1): schedules.json -> courses_with_urls
// --------------------
function buildFromSchedules() {
	console.log(`📖 読み込み(schedules): ${schedulesPath}`);

	if (!fs.existsSync(schedulesPath)) {
		throw new Error(`schedules.json が存在しません: ${schedulesPath}`);
	}

	const raw = fs.readFileSync(schedulesPath, "utf-8");
	const data = JSON.parse(raw);

	const map = new Map();

	for (const item of data) {
		const { prefix = "", month, area, category = "" } = item.courseParts;

		const key = `${prefix}${String(month).padStart(2, "0")}月${area}${category}`;

		if (!map.has(key)) {
			map.set(key, {
				courseKey: item.course,
				month: item.courseParts.month,
				area: item.courseParts.area,
				category: item.courseParts.category,
				lmsListUrl: makeLmsListUrl(item.courseParts),
				count: 0,
			});
		}
		map.get(key).count++;
	}

	return Array.from(map.values());
}

// --------------------
// Core(2): available.json -> courses_with_urls（未調整コマ用）
// --------------------
function buildFromAvailable(availablePath) {
	console.log(`📖 読み込み(available): ${availablePath}`);

	if (!fs.existsSync(availablePath)) {
		throw new Error(`available.json が存在しません: ${availablePath}`);
	}

	const raw = fs.readFileSync(availablePath, "utf-8");
	const items = JSON.parse(raw);

	const map = new Map();

	for (const it of items) {
		// parser.py のスキーマ想定:
		// { area: "大阪", raw: "・【大阪】2025年6月開講..." , ... }
		const area = it.area || (it.raw?.match(/【([^】]+)】/) || [])[1];
		const month =
			it.month ??
			(it.raw?.match(/(\d{4})年(\d{1,2})月/) ? Number(RegExp.$2) : null);

		if (!area || !month) continue;

		const key = `${String(month).padStart(2, "0")}月${area}`;
		if (!map.has(key)) {
			map.set(key, {
				courseKey: key, // 未調整コマはカテゴリ不明なのでこの命名でOK
				month,
				area,
				category: "",
				lmsListUrl: makeLmsListUrl({ month, area }),
				count: 0,
			});
		}
		map.get(key).count++;
	}

	return Array.from(map.values());
}

// --------------------
// API：出力先を指定 + 入力モードも指定
//   mode: "schedules" | "available"
// --------------------
export async function attachLmsListUrlTo(
	outDir,
	fileName = "courses_with_urls.json",
	options = {},
) {
	const mode = options.mode || "schedules";

	let results;
	if (mode === "available") {
		const availablePath =
			options.availablePath || path.join(outDir, "available.json");
		results = buildFromAvailable(availablePath);
	} else {
		results = buildFromSchedules();
	}

	if (!fs.existsSync(outDir)) {
		fs.mkdirSync(outDir, { recursive: true });
	}

	const outPath = path.join(outDir, fileName);
	fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

	console.log(
		`🎉 courses_with_urls.json を作成しました！ -> ${outPath}（${results.length}件）`,
	);
	return { outPath, count: results.length };
}

// --------------------
// デフォルト（安全）
// --------------------
export async function attachLmsListUrlDefault() {
	return attachLmsListUrlTo(dataDir, "courses_with_urls.json", {
		mode: "schedules",
	});
}

// --------------------
// CLI
//   node modules/lms/attachLmsListUrl.js
//   node modules/lms/attachLmsListUrl.js apply-message-maker/data
//   node modules/lms/attachLmsListUrl.js apply-message-maker/data courses_with_urls.json --from=available
// --------------------
const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
	(async () => {
		const args = process.argv.slice(2);

		// args が空ならデフォルト実行
		if (args.length === 0) {
			await attachLmsListUrlDefault();
			process.exit(0);
		}

		const outDir = path.resolve(process.cwd(), args[0]);
		const fileName =
			args[1] && !args[1].startsWith("--") ? args[1] : "courses_with_urls.json";

		const flags = args.filter((a) => a.startsWith("--"));
		const fromAvailable = flags.includes("--from=available");

		await attachLmsListUrlTo(outDir, fileName, {
			mode: fromAvailable ? "available" : "schedules",
		});

		process.exit(0);
	})().catch((e) => {
		console.error("❌ エラー:", e);
		process.exit(1);
	});
}
