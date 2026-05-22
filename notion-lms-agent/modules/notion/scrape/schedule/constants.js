// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/notion/scrape/schedule/constants.js
// Shared Notion schedule view URL

import { loadParentEnv } from "../../../common/loadEnv.js";

// Ensure .env is loaded when this module is imported
loadParentEnv(import.meta.url);

const DEFAULT_VIEW_URL = "https://www.notion.so/your_workspace/your_view_id";

export const NOTION_VIEW_URL = (process.env.NOTION_SCHEDULE_URL || DEFAULT_VIEW_URL).trim();
