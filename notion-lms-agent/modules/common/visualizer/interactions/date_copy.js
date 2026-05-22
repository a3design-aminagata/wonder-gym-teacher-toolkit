// modules/common/visualizer/interactions/date_copy.js

document.addEventListener("click", async (e) => {
	const dayEl = e.target.closest(".date-header .day");
	if (!dayEl) return;

	const th = dayEl.closest(".date-header");
	const date = th?.dataset?.date;
	if (!date) return;

	e.preventDefault();

	try {
		await navigator.clipboard.writeText(date);
		console.log("[date_copy] copied:", date);
	} catch {
		window.prompt("日付をコピーしてください:", date);
	}
});
