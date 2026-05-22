// modules/notion/run/scrapeSchedule.js

import { scrapeSchedule } from "../scrape/schedule/index.js";

async function run() {
	const args = process.argv.slice(2);

	const mode = args.includes("--past")
		? "past"
		: args.includes("--range")
			? "range"
			: "auto";

	const withPast = args.includes("--with-past");

	console.log("▶ Notion scrape schedule", { mode, withPast });

	await scrapeSchedule({
		mode,
		withPast,
	});
}

run().catch((e) => {
	console.error("❌ scrapeSchedule failed");
	console.error(e);
	process.exit(1);
});
