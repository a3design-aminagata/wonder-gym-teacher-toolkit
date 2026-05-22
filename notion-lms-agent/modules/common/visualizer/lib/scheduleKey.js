// scheduleKey.js

export function normalizeTime(t) {
  const m = String(t || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(t || "").trim();
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function scheduleKeyOf(date, time) {
  return `${date}T${normalizeTime(time)}`;
}
