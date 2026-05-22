// modules/common/loadEnv.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

export function loadParentEnv(importMetaUrl) {
  // 呼び出し元ファイルの場所
  const __filename = fileURLToPath(importMetaUrl);
  let currentDir = path.dirname(__filename);

  // 無限ループ防止のため上限
  const maxLevels = 20;
  let level = 0;

  while (level < maxLevels) {
    const envPath = path.join(currentDir, ".env");

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log("[ENV] loaded from:", envPath);
      return;
    }

    // 1階層上へ移動
    const parent = path.resolve(currentDir, "..");

    // これ以上上がれない場合（rootに達した）
    if (parent === currentDir) break;

    currentDir = parent;
    level++;
  }

  console.error("[ENV] ERROR: 上位階層に .env が見つかりませんでした");
}
