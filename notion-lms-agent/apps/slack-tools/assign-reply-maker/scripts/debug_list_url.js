import { parseSlackLine } from "../core/parseSlackLine.js";
import { makeLmsListUrl } from "../core/makeLmsListUrl.js";

const line = "■ 12/05(金) 16:00 【新潟】2025年7月開講(6ヶ月) 10回目/19回目";

const info = parseSlackLine(line);
const url = makeLmsListUrl({ month: info.month, area: info.area });

console.log(url);
