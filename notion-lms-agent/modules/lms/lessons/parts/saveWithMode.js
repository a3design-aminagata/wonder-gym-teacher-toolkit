// modules/lms/lessons/parts/saveWithMode.js
import fs from "fs";

function readJson(p) {
	if (!fs.existsSync(p)) return [];
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
	fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

/**
 * mode に応じて保存
 * - all        : 完全上書き
 * - week/today: patchFn があれば既存に patch
 */

export function saveWithMode({ mode, outPath, out, patchFn }) {
	if (mode === "all") {
		writeJson(outPath, out);
		console.log("♻️ full overwrite (all)");
		return;
	}

	const existingAll = readJson(outPath);

	if (!existingAll.length || typeof patchFn !== "function") {
		writeJson(outPath, out);
		console.log("📝 overwrite (no patch)");
		return;
	}

	patchFn(existingAll, out);
	writeJson(outPath, existingAll);
	console.log("🩹 patched existing data");
}
