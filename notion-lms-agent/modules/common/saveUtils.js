import fs from "node:fs/promises";
import { statSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

export async function loadJSON(filename, importMetaUrl = import.meta.url) {
  const dataDir = findRootDataDir(importMetaUrl);
  const loadPath = path.join(dataDir, filename);

  const text = await fs.readFile(loadPath, "utf8");
  return JSON.parse(text);
}
/**
 * notion-lms-agent 直下の data を探す
 */
function findRootDataDir(importMetaUrl = import.meta.url) {
  const __filename = fileURLToPath(importMetaUrl);
  let currentDir = path.dirname(__filename);

  const maxLevels = 20;
  let level = 0;

  while (level < maxLevels) {
    const candidate = path.join(currentDir, "data");

    // ★ modules/data は無視する
    if (!candidate.includes("/modules/")) {
      try {
        const stat = statSync(candidate);
        if (stat.isDirectory()) return candidate;
      } catch (_) {}
    }

    const parent = path.resolve(currentDir, "..");
    if (parent === currentDir) break;

    currentDir = parent;
    level++;
  }

  throw new Error("❌ notion-lms-agent/data が見つかりませんでした");
}

export async function saveJSON(
  filename,
  data,
  importMetaUrl = import.meta.url
) {
  const dataDir = findRootDataDir(importMetaUrl);
  const savePath = path.join(dataDir, filename);

  await fs.writeFile(savePath, JSON.stringify(data, null, 2), "utf8");

  console.log(`💾 JSON 保存完了 → ${savePath}`);
  return savePath;
}
