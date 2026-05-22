// apps/slack-tools/assign-reply-maker/core/parseSlackLine.js

export function parseSlackLine(line) {
  // パターンA：日付＋時間あり
  // 例: "■ 12/05(金) 16:00 【新潟】2025年7月開講(6ヶ月) 10回目/19回目"
  const withDateAndTime = line.match(
    /^[■・]?\s*(\d{2}\/\d{2}\(.+?\))\s+(\d{1,2}:\d{2})\s+【(.+?)】(\d{4})年(\d+)月開講.*?(\d+)回目\/(\d+)回目/
  );

  if (withDateAndTime) {
    const [, dateLabel, timeLabel, area, year, month, timesA, timesB] =
      withDateAndTime;

    return {
      dateLabel,
      timeLabel,
      area,
      year: Number(year),
      month: Number(month),
      timesCandidates: [Number(timesA), Number(timesB)],
    };
  }

  // パターンB：時間だけあり
  // 例: "16:00 【新潟】2025年7月開講(6ヶ月) 10回目/19回目"
  const withTimeOnly = line.match(
    /^[■・]?\s*(\d{1,2}:\d{2})\s+【(.+?)】(\d{4})年(\d+)月開講.*?(\d+)回目\/(\d+)回目/
  );

  if (withTimeOnly) {
    const [, timeLabel, area, year, month, timesA, timesB] = withTimeOnly;

    return {
      dateLabel: null,
      timeLabel,
      area,
      year: Number(year),
      month: Number(month),
      timesCandidates: [Number(timesA), Number(timesB)],
    };
  }

  // パターンC：日付・時間なし
  // 例: "・【島根】2025年9月開講(6ヶ月) 1回目/10回目"
  const noDateNoTime = line.match(
    /^[■・]?\s*【(.+?)】(\d{4})年(\d+)月開講.*?(\d+)回目\/(\d+)回目/
  );

  if (noDateNoTime) {
    const [, area, year, month, timesA, timesB] = noDateNoTime;

    return {
      dateLabel: null,
      timeLabel: null,
      area,
      year: Number(year),
      month: Number(month),
      timesCandidates: [Number(timesA), Number(timesB)],
    };
  }

  throw new Error("Slack 行のパースに失敗しました: " + line);
}
