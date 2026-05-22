// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/index.js

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 1. 環境変数を「最優先・上書き許可」で読み込む
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// notion-lms-agent 直下の .env を強制読み込み
dotenv.config({
	path: path.resolve(__dirname, "../../.env"),
	override: true,
});

// デバッグログ
console.log("------------------------------------------");
console.log(
	"Checking Notion URL:",
	process.env.NOTION_SCHEDULE_URL ? "✅ FOUND" : "❌ MISSING",
);
console.log("------------------------------------------");

async function start() {
	// 2. 環境変数が整った「後」で、メインロジックを読み込む（重要！）
	const { runVisualizerPipeline } = await import("./pipeline.js");

	const args = process.argv.slice(2);
	const options = {
		mode: args.find((a) => !a.startsWith("--")) || "all",
		useNotion: args.includes("--notion"),
		forceSchedules: args.includes("--force-schedules"),
		forceTeacher: args.includes("--force-teacher"),
		shiftMode: args.includes("--shift") || args.includes("--shift-only") ? "run" : "none",
		shiftOnly: args.includes("--shift-only"),
		notionPreview: args.includes("--notion-preview"),
		openNotionDuringShift: args.includes("--open-notion-during-shift"),
		keepBrowserOpen: args.includes("--keep-browser-open"),
		profileDirectory: (() => {
			const v = args.find((a) => a.startsWith("--profile-directory="));
			if (!v) return null;
			return v.split("=", 2)[1] || null;
		})(),
	};

	// shift-only の場合は Notion/LMS スクレイプを飛ばしてキュー処理だけ
	if (options.shiftOnly) {
		options.mode = "shift-only";
	}
	// notion preview 専用フラグ時は mode を preview に上書き
	if (options.notionPreview) {
		options.mode = "notion-preview";
	}

	try {
		await runVisualizerPipeline(options);
	} catch (e) {
		console.error("❌ visualizer failed");
		console.error(e);
		process.exit(1);
	}
}

start();
