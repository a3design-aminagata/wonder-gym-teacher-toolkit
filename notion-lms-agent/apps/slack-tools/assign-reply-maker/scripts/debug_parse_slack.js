import { parseSlackLine } from "../core/parseSlackLine.js";

const line = "■ 12/05(金) 16:00 【新潟】2025年7月開講(6ヶ月) 10回目/19回目";

console.log(parseSlackLine(line));
