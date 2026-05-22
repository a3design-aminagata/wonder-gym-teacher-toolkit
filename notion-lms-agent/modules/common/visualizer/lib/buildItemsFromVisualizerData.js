// modules/common/visualizer/lib/buildItemsFromVisualizerData.js

(function () {
	function buildItemsFromVisualizerData(VISUALIZER_DATA) {
		const items = [];

		const pushItem = (i, fallbackType) => {
			const area = i.area || "";
			const month = i.month;
			const label = `${area}${month}月`;

			items.push({
				date: i.date,
				time: normalizeTime(i.time),
				label,
				type: i.type || fallbackType,
				isOrphan: i.isOrphan === true,
				materials: i.materials || [],
				lmsUrl: i.lmsUrl || null,
				teacherStatus: i.teacherStatus || null,
				editUrls: i.editUrls || [],
				teacherNames: i.teacherNames || [],
				hasAttendanceComment: i.hasAttendanceComment === true,
				hasAbsent: i.hasAbsent === true,
				area,
				month,
				raw: i.raw || "",
			});
		};

		(VISUALIZER_DATA.available || []).forEach((i) => pushItem(i, "available"));
		(VISUALIZER_DATA.mine || []).forEach((i) => pushItem(i, "mine"));
		(VISUALIZER_DATA.past || []).forEach((i) => pushItem(i, "past"));

		const ORPHAN_DATA = window.ORPHAN_VISUALIZER_DATA || [];
		ORPHAN_DATA.forEach((i) =>
			pushItem(
				{
					...i,
					type: "mine",
					isOrphan: true,
				},
				"mine",
			),
		);

		items.sort((a, b) => {
			if (a.date === b.date)
				return parseTimeToNumber(a.time) - parseTimeToNumber(b.time);
			return a.date < b.date ? -1 : 1;
		});

		return items;
	}

	// ★ windowに公開
	window.buildItemsFromVisualizerData = buildItemsFromVisualizerData;
})();
