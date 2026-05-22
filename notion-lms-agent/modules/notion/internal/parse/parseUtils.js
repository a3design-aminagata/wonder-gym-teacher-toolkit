// modules/notion/parseUtils.js

export function parseRaw(raw) {
	const lines = raw.split("\n");
	return {
		course: lines[0] || "",
		dateRaw: lines[1] || "",
		countRaw: lines[2] || "",
		dayLabel: lines[3] || "",
	};
}

export function parseCourse(courseRaw) {
	if (!courseRaw) {
		return { prefix: "", month: "", area: "", category: "" };
	}

	courseRaw = courseRaw.trim();

	// ① 先頭タグ取得（例: 【FC】）
	let prefix = "";
	const prefixMatch = courseRaw.match(/^(【.*?】)/);
	if (prefixMatch) {
		prefix = prefixMatch[1];
		courseRaw = courseRaw.replace(prefix, "");
	}

	// ② 年付き
	let m = courseRaw.match(/(\d{2})年(\d{1,2})月(.+?)(デザイン|マーケ)/);
	if (m) {
		const [, , month, area, category] = m;
		return {
			prefix,
			month: Number(month),
			area,
			category,
		};
	}

	// ③ 年なし
	m = courseRaw.match(/(\d{1,2})月(.+?)(デザイン|マーケ)/);
	if (m) {
		const [, month, area, category] = m;
		return {
			prefix,
			month: Number(month),
			area,
			category,
		};
	}

	return { prefix, month: "", area: "", category: "" };
}

export function parseDate(dateRaw, dayLabel) {
	if (!dateRaw) {
		return {
			raw: "",
			iso: "",
			year: "",
			month: "",
			day: "",
			time: "",
			weekday: "",
		};
	}

	const dateMatch = dateRaw.match(/(\d+)年(\d+)月(\d+)日\s+(\d+):(\d+)/);
	const weekdayMatch = dayLabel.match(/(.曜)/);

	if (!dateMatch) {
		return { raw: dateRaw };
	}

	const [_, y, m, d, hh, mm] = dateMatch;

	return {
		raw: dateRaw,
		iso: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(
			2,
			"0",
		)}:${mm}:00`,
		year: Number(y),
		month: Number(m),
		day: Number(d),
		time: `${hh}:${mm}`,
		weekday: weekdayMatch ? weekdayMatch[1] : "",
	};
}

export function parseCount(countRaw) {
	const match = countRaw.match(/(\d+)回目\/(\d+)回目/);
	if (!match) {
		return { raw: countRaw, current: "", total: "" };
	}
	return {
		raw: countRaw,
		current: Number(match[1]),
		total: Number(match[2]),
	};
}
