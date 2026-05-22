// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/run/run_all_visualizer.js
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === フルパス ===
const BASE_DIR = "/path/to/wonder-gym-teacher-toolkit/notion-lms-agent";

const RUN_SCRAPE_SCHEDULE = path.join(
	BASE_DIR,
	"modules/notion/run/run_scrapeSchedule.js",
);

const BUILD_SCHEDULES_ENRICHED = path.join(
	BASE_DIR,
	"modules/common/canonical/build_schedules_enriched.js",
);

const RUN_VISUALIZER_PIPELINE = path.join(
	BASE_DIR,
	"apps/schedule-visualizer/run_visualizer_pipeline.js",
);

const BUILD_ORPHAN_VISUALIZER = path.join(
	BASE_DIR,
	"apps/schedule-visualizer/build_orphan_visualizer_data.js",
);

async function runCommand(cmd) {
	console.log(`▶ executing: ${cmd}`);
	try {
		const { stdout, stderr } = await execAsync(cmd);
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
	} catch (err) {
		console.error("❌ command failed:", cmd);
		console.error(err);
		process.exit(1);
	}
}

async function run() {
	const args = process.argv.slice(2);

	const skipNotion = args.includes("--skip-notion");
	const orphanOnly = args.includes("--orphan-only");

	console.log("🚀 schedule visualizer pipeline start");

	// =========================
	// orphan-only モード
	// =========================
	if (orphanOnly) {
		console.log("⚠ orphan-only mode enabled");

		// orphan-only の場合は orphan データ生成のみ
		await runCommand(`node "${BUILD_ORPHAN_VISUALIZER}"`);

		console.log("✅ orphan-only pipeline done");
		return;
	}

	// =========================
	// 通常フルパイプライン
	// =========================

	// 1. Notion scrape
	if (!skipNotion) {
		await runCommand(`node "${RUN_SCRAPE_SCHEDULE}" --range`);
	} else {
		console.log("▶ skip Notion scrape (--skip-notion)");
	}

	// 2. schedules_enriched.json 生成
	await runCommand(`node "${BUILD_SCHEDULES_ENRICHED}"`);

	// 3. visualizer pipeline
	const notionFlag = skipNotion ? "" : "--notion";
	await runCommand(`node "${RUN_VISUALIZER_PIPELINE}" all ${notionFlag}`);

	// 4. orphan visualizer data
	await runCommand(`node "${BUILD_ORPHAN_VISUALIZER}"`);

	console.log("✅ full pipeline done");
}

run();
