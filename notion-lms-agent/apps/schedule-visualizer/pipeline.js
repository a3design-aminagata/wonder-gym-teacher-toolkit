// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/apps/schedule-visualizer/pipeline.js
import { scrapeLessonsForTeacher } from "../../modules/lms/lessons/scrape_lessons_for_teacher.js";
import { scrapeLmsLessonsForSchedules } from "../../modules/lms/lessons/scrape_lessons_for_schedules.js";
import { buildVisualizerDataFromSchedules } from "./build_data_from_schedules.js";
import { buildOrphanVisualizerData } from "./build_orphan_visualizer_data.js";
import { buildSubstituteData } from "./build_substitute_data.js";
import { scrapeSchedule } from "../../modules/notion/scrape/schedule/index.js";
import { buildSchedulesEnriched } from "../../modules/common/canonical/build_schedules_enriched.js";
import { scrapeUserGroupsDefault } from "../../modules/lms/groups/scrapeUserGroups.js";
import { attachLmsListUrlDefault } from "../../modules/lms/groups/attachLmsListUrl.js";
import { runShiftAssigner } from "./shift_runner.js";
import { runNotionPreview } from "./notion_preview.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

function runNodeScript(args, { cwd = ROOT, label = "node task" } = {}) {
	return new Promise((resolve, reject) => {
		console.log(`▶ ${label}: node ${args.join(" ")}`);
		const child = spawn(process.execPath, args, {
			cwd,
			stdio: "inherit",
			env: process.env,
		});
		child.on("error", reject);
		child.on("close", (code) => resolve(code ?? 1));
	});
}

async function runPostShiftFollowups() {
	const auditorCode = await runNodeScript(
		["apps/schedule-auditor/run.js", "--json", "data/schedules_enriched.json"],
		{ label: "step5: schedule auditor" },
	);
	if (auditorCode !== 0) {
		console.log(`ℹ schedule-auditor is not OK (exit=${auditorCode})`);
		console.log("ℹ step5.1: visualizer refresh をスキップします");
		return;
	}

	console.log("✅ schedule-auditor: status OK (一致)");
	const refreshCode = await runNodeScript(["apps/schedule-visualizer/index.js", "all"], {
		label: "step5.1: visualizer refresh (all)",
	});
	if (refreshCode !== 0) {
		throw new Error(`visualizer refresh failed (exit=${refreshCode})`);
	}
}

export async function runVisualizerPipeline(options) {
	const {
		mode,
		useNotion,
		forceSchedules,
		forceTeacher,
		shiftMode = "none", // "none" | "run"
		shiftOnly = false,
		notionPreview = false,
		openNotionDuringShift = false,
		keepBrowserOpen = false,
		profileDirectory = null,
	} = options;
	const keepNotionSessionForShift = useNotion && shiftMode !== "none" && openNotionDuringShift;
	let notionSession = null;

	// notion-preview: Notion を開いて読み込みだけ行い、そのまま停止
	if (notionPreview) {
		await runNotionPreview({ profileDirectory });
		return;
	}

	// shift-only: 既存データを前提にキュー処理だけ実行
	if (shiftOnly) {
		await runShiftAssigner({
			shiftMode,
			openNotionDuringShift,
			keepBrowserOpen,
			profileDirectory,
		});
		await runPostShiftFollowups();
		return;
	}

	// step0: Notion scrape
	if (useNotion && mode === "all") {
		console.log(`▶ step0: scrape Notion schedules`);
		const scrapeResult = await scrapeSchedule({
			keepBrowserOpen: keepNotionSessionForShift,
		});
		if (keepNotionSessionForShift && scrapeResult?.browser && scrapeResult?.page) {
			notionSession = scrapeResult;
		}
	} else {
		console.log("▶ step0: skip Notion scrape");
	}
	// step0.4: build courses_with_urls.json
	console.log("▶ step0.4: build courses_with_urls.json");
	await attachLmsListUrlDefault();

	// step0.5: LMS user groups
	if (mode === "all") {
		console.log("▶ step0.5: scrape LMS user groups");
		await scrapeUserGroupsDefault();
	}
	// step0.6: build schedules_enriched.json（schedules.json があれば必ず実行）
	console.log("▶ step0.6: build schedules_enriched.json");
	await buildSchedulesEnriched();

	// step1: LMS scrape

	console.log("▶ step1: scrape LMS lessons", `[mode=${mode}]`);

	if (forceTeacher) {
		console.log("  → force TEACHER scrape");
		await scrapeLessonsForTeacher(mode);
	} else if (forceSchedules || mode === "all") {
		console.log("  → SCHEDULES-based scrape");
		await scrapeLmsLessonsForSchedules(mode);
	} else {
		console.log("  → TEACHER-based scrape");
		await scrapeLessonsForTeacher(mode);
	}

	// mode=all では orphan も毎回最新化する（manual pending の自動解消に必要）
	if (mode === "all" && !forceTeacher) {
		console.log("▶ step1.1: refresh LMS orphan lessons (teacher-based)");
		await scrapeLessonsForTeacher(mode, {
			writeSchedules: false,
			writeOrphan: true,
		});
	}

	// step2: 正規スケジュール可視化
	console.log("▶ step2: build VISUALIZER_DATA (data.js)");
	buildVisualizerDataFromSchedules();

	// step3: orphan 可視化
	console.log("▶ step3: build ORPHAN_VISUALIZER_DATA");
	buildOrphanVisualizerData();

	// step3.5: substitute（交代）可視化
	console.log("▶ step3.5: build SUBSTITUTE_VISUALIZER_DATA");
	await buildSubstituteData();

	// step4: shift register assist
	if (shiftMode !== "none") {
		await runShiftAssigner({
			shiftMode,
			openNotionDuringShift,
			keepBrowserOpen,
			profileDirectory,
			browser: notionSession?.browser || null,
			notionPage: notionSession?.page || null,
		});
		await runPostShiftFollowups();
	}
}
