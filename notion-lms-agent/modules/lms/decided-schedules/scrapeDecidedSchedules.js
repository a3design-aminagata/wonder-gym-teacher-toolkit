import { LMS_DECIDED_SCHEDULES_URL } from "../constants.js";

function normSpace(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function normTime(t) {
  const m = String(t ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(t ?? "").trim();
  return `${Number(m[1])}:${m[2]}`;
}

function parseJpDateTimeRange(text) {
  const t = normSpace(text);
  const m = t.match(
    /(\d{4})年(\d{2})月(\d{2})日\([月火水木金土日]\)\s+(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/
  );
  if (!m) return null;
  const [_, yyyy, mm, dd, start, end] = m;
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: normTime(start),
    endTime: normTime(end),
    raw: t,
  };
}

function parseUserGroupName(text) {
  const t = normSpace(text);
  const areaMatch = t.match(/【([^】]+)】/);
  const monthMatch = t.match(/(\d{4})年(\d{1,2})月開講/);
  return {
    raw: t,
    area: areaMatch ? areaMatch[1] : null,
    courseStartYear: monthMatch ? Number(monthMatch[1]) : null,
    courseStartMonth: monthMatch ? Number(monthMatch[2]) : null,
  };
}

export async function scrapeDecidedSchedules(page, { year, month }) {
  const url = `${LMS_DECIDED_SCHEDULES_URL}?year=${year}&month=${month}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const tableSelector = "table.text-xs.text-center.block.py-2";
  await page.waitForSelector(tableSelector, { timeout: 30000 });

  const rows = await page.$$eval(`${tableSelector} tbody tr`, (trs) => {
    const out = [];
    for (const tr of trs) {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (!tds.length) continue;

      const getText = (idx) =>
        (tds[idx]?.textContent ?? "").replace(/\s+/g, " ").trim();
      const getHrefInCell = (idx) => {
        const a = tds[idx]?.querySelector("a");
        return a ? a.getAttribute("href") || "" : "";
      };

      const company = getText(0);
      const dateTimeText = getText(1);
      const meetUrl = getHrefInCell(1);
      const userGroupText = getText(2);
      const field = getText(3);
      const numberOfTimesText = getText(4);
      const numberOfTimes = numberOfTimesText
        ? Number(numberOfTimesText)
        : null;

      const editLink = tr.querySelector("a.admin-indigo-button-round");
      const attendanceEditUrl = editLink
        ? editLink.getAttribute("href") || ""
        : "";

      out.push({
        company,
        dateTimeText,
        meetUrl,
        userGroupText,
        field,
        numberOfTimes,
        attendanceEditUrl,
      });
    }
    return out;
  });

  const normalized = rows.map((r) => {
    const dt = parseJpDateTimeRange(r.dateTimeText);
    const ug = parseUserGroupName(r.userGroupText);

    return {
      sourceUrl: url,
      company: normSpace(r.company),
      date: dt?.date ?? null,
      time: dt?.time ?? null,
      endTime: dt?.endTime ?? null,
      _rawDateTimeText: dt?.raw ?? normSpace(r.dateTimeText),
      userGroupName: ug.raw,
      area: ug.area,
      courseStartYear: ug.courseStartYear,
      courseStartMonth: ug.courseStartMonth,
      field: normSpace(r.field) || null,
      numberOfTimes: Number.isFinite(r.numberOfTimes) ? r.numberOfTimes : null,
      meetUrl: r.meetUrl || null,
      attendanceEditUrl: r.attendanceEditUrl || null,
    };
  });

  const invalid = normalized.filter(
    (x) =>
      !x.date || !x.time || !x.area || !x.courseStartMonth || !x.numberOfTimes
  );

  return { url, rows: normalized, invalid };
}
