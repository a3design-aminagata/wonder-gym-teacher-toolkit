// apps/slack-tools/assign-reply-maker/scripts/fetch_user_group_ids_for_assign.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { wait } from "../../../modules/common/wait.js";
import { makeLmsListUrl } from "../core/makeLmsListUrl.js";
import { openLmsSession } from "../../../modules/lms/auth/loginLms.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .../notion-lms-agent
const projectRoot = path.resolve(__dirname, "..", "..", "..");

// work ディレクトリ関連
const assignReplyMakerDir = path.resolve(__dirname, ".."); // .../apps/slack-tools/assign-reply-maker
const workDir = path.join(assignReplyMakerDir, "work");
const assignBlockPath = path.join(workDir, "assign_block.json");
const outputPath = path.join(workDir, "assign_with_group_ids.json");

async function main() {
  // assign_block.json 読み込み
  if (!fs.existsSync(assignBlockPath)) {
    console.error("❌ assign_block.json が見つかりません:", assignBlockPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(assignBlockPath, "utf-8");
  const assignBlock = JSON.parse(raw);

  const { area, month } = assignBlock;

  if (!area || !month) {
    console.error(
      "❌ assign_block.json に area / month がありません:",
      assignBlock
    );
    process.exit(1);
  }

  console.log("📦 assign_block.json:", assignBlock);

  const listUrl = makeLmsListUrl({ month, area });
  console.log("🔗 一覧URL:", listUrl);

  const { browser, page } = await openLmsSession();

  try {
    await page.goto(listUrl, { waitUntil: "networkidle2" });
    await wait(1200);

    const ids = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));

      return rows
        .map((tr) => {
          const link = tr.querySelector('a[href*="/user_groups/"]');
          if (!link) return null;
          const m = link.href.match(/user_groups\/(\d+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
    });

    console.log("🧾 取得した user_group IDs:", ids);

    if (ids.length === 0) {
      console.error("❌ user_groups テーブルから ID が取得できませんでした");
      process.exit(1);
    }

    const result = {
      area,
      month,
      userGroupIds: ids,
    };

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

    console.log(
      "🎉 assign_with_group_ids.json を作成しました！ ->",
      outputPath
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
