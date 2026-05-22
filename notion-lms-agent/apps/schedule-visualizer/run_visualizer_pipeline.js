// apps/schedule-visualizer/run_visualizer_pipeline.js
import { scrapeLessonsForTeacher } from "../../modules/lms/lessons/scrape_lessons_for_teacher.js";
import { scrapeLmsLessonsForSchedules } from "../../modules/lms/lessons/scrape_lessons_for_schedules.js";
import { buildVisualizerDataFromSchedules } from "./build_data_from_schedules.js";
import { buildOrphanVisualizerData } from "./build_orphan_visualizer_data.js";
import { buildSubstituteData } from "./build_substitute_data.js";
import { scrapeSchedule } from "../../modules/notion/scrape/schedule/index.js";
import { buildSchedulesEnriched } from "../../modules/common/canonical/build_schedules_enriched.js";
import { scrapeUserGroupsDefault } from "../../modules/lms/groups/scrapeUserGroups.js";
import { attachLmsListUrlDefault } from "../../modules/lms/groups/attachLmsListUrl.js";

async function run() {
	const args = process.argv.slice(2);

	const mode = args.find((a) => !a.startsWith("--")) || "all";
	const useNotion = args.includes("--notion");

	// Notion 用 mode
	const notionMode = "auto";

	// step0: Notion scrape
	if (useNotion && mode === "all") {
		console.log(`▶ step0: scrape Notion schedules`);
		await scrapeSchedule();
	} else {
		console.log("▶ step0: skip Notion scrape");
	}
	// step0.4: build courses_with_urls.json
	console.log("▶ step0.4: build courses_with_urls.json");
	await attachLmsListUrlDefault();

	// step0.5: build schedules_enriched.json（schedules.json があれば必ず実行）
	console.log("▶ step0.5: build schedules_enriched.json");
	await buildSchedulesEnriched();

	// step0.6: LMS user groups
	if (mode === "all") {
		console.log("▶ step0.6: scrape LMS user groups");
		await scrapeUserGroupsDefault();
	}

	// step1: LMS scrape
	const forceSchedules = args.includes("--force-schedules");
	const forceTeacher = args.includes("--force-teacher");

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

	// step2: 正規スケジュール可視化
	console.log("▶ step2: build VISUALIZER_DATA (data.js)");
	buildVisualizerDataFromSchedules();

	// step3: orphan 可視化
	console.log("▶ step3: build ORPHAN_VISUALIZER_DATA");
	buildOrphanVisualizerData();

	// step3.5: substitute（交代）可視化
	console.log("▶ step3.5: build SUBSTITUTE_VISUALIZER_DATA");
	await buildSubstituteData();
}

run().catch((e) => {
	console.error("❌ visualizer pipeline failed");
	console.error(e);
	process.exit(1);
});
