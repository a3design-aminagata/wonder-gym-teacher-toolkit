// /path/to/wonder-gym-teacher-toolkit/notion-lms-agent/modules/lms/lessons/parts/extractLmsTable.js
export async function extractLmsTable(page) {
	return await page.evaluate(() => {
		const table = document.querySelector("table.text-center");
		if (!table) return [];

		const trs = Array.from(table.querySelectorAll("tbody tr"));
		const out = [];

		let current = {
			isMakeup: false,
			countLabel: null,
			teacherName: null,
			lessonUrl: null,
			editUrl: null,
			date: null,
			start: null,
			end: null,
		};

		function text(el) {
			return (el?.textContent || "").trim();
		}
		function valueOf(el) {
			if (!el) return "";
			if (el.tagName === "SELECT") {
				const selectedText = (el.selectedOptions?.[0]?.textContent || "").trim();
				return selectedText || el.value || "";
			}
			if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
				return el.value || "";
			}
			return (el.textContent || "").trim();
		}
		function cellValue(td) {
			if (!td) return "";
			const formEl = td.querySelector("textarea, select, input:not([type='hidden'])");
			if (formEl) return valueOf(formEl).trim();
			return text(td);
		}

		function parseDt(dtText) {
			const m = dtText.match(
				/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/,
			);

			if (!m) return null;

			const yyyy = m[1];
			const mm = m[2].padStart(2, "0");
			const dd = m[3].padStart(2, "0");

			return {
				date: `${yyyy}-${mm}-${dd}`,
				start: m[4],
				end: m[5],
			};
		}

		for (const tr of trs) {
			const tds = Array.from(tr.querySelectorAll("td"));
			console.log(
				"[DEBUG td texts]",
				tds.map((td) => td.innerText.trim()),
			);
			const editA = tds[0]?.querySelector(
				'a[href*="/online_lessons/"][href$="/edit"]',
			);

			const editUrl = editA ? editA.getAttribute("href") : null;

			const makeupText = text(tds[1]);
			const countLabel = text(tds[2]);
			const dtText = text(tds[3]) || "";
			const teacherName = text(tds[4]);
			const lessonA = tds[5]?.querySelector("a[href^='http']");
			const lessonUrl = lessonA ? lessonA.getAttribute("href") : "";

			const parsed = parseDt(dtText);
			if (parsed) {
				current = {
					isMakeup: makeupText === "振替",
					countLabel: countLabel || null,
					teacherName: teacherName || null,
					lessonUrl: lessonUrl || null,
					editUrl: editUrl || null,
					date: parsed.date,
					start: parsed.start,
					end: parsed.end,
				};
			} else {
				current = {
					...current,
					isMakeup: current.isMakeup || makeupText === "振替",
					editUrl: editUrl || current.editUrl,
				};
			}

			const studentName = text(tds[6]);
			if (!studentName) continue;

			out.push({
				date: current.date,
				start: current.start,
				end: current.end,
				isMakeup: current.isMakeup,
				countLabel: current.countLabel,
				teacherName: current.teacherName,
				lessonUrl: current.lessonUrl,
				editUrl: current.editUrl,
				studentName,
				furigana: cellValue(tds[7]),

				attendance: cellValue(tds[8]),
				motivation: cellValue(tds[9]),
				progress: cellValue(tds[10]),
				comment: cellValue(tds[11]),
			});
		}

		return out;
	});
}
