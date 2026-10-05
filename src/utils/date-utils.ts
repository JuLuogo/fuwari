export function formatDateToYYYYMMDD(date: Date): string {
	return date.toISOString().substring(0, 10);
}

export function formatPostDateForDisplay(date: Date, showTime = true): string {
	const isDateOnly =
		date.getUTCHours() === 0 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0;

	const timeZone = "Asia/Shanghai";

	const dateParts = new Intl.DateTimeFormat("zh-CN", {
		timeZone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(date);
	const y = dateParts.find((p) => p.type === "year")?.value ?? "";
	const m = dateParts.find((p) => p.type === "month")?.value ?? "";
	const d = dateParts.find((p) => p.type === "day")?.value ?? "";

	// 获取当前年份
	const currentYear = new Date().getFullYear().toString();
	// 如果是今年，只显示月日，否则显示完整日期
	const datePart = y === currentYear ? `${m}月${d}日` : `${y}年${m}月${d}日`;
	if (isDateOnly || !showTime) return datePart;

	const timeParts = new Intl.DateTimeFormat("zh-CN", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).formatToParts(date);
	const hh = timeParts.find((p) => p.type === "hour")?.value ?? "00";
	const mm = timeParts.find((p) => p.type === "minute")?.value ?? "00";
	const ss = timeParts.find((p) => p.type === "second")?.value ?? "00";

	const timePart = ss !== "00" ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
	return `${datePart} ${timePart}`;
}

export function parsePostDateToDate(value: unknown): Date {
	if (value instanceof Date) return value;
	if (typeof value !== "string") return new Date(String(value));

	const s = value.trim();
	const dateOnly = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
	if (dateOnly) {
		const y = Number(dateOnly[1]);
		const m = Number(dateOnly[2]);
		const d = Number(dateOnly[3]);
		return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
	}

	const localNoZone =
		/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
	if (localNoZone) {
		const y = Number(localNoZone[1]);
		const m = Number(localNoZone[2]);
		const d = Number(localNoZone[3]);
		const hh = Number(localNoZone[4]);
		const mm = Number(localNoZone[5]);
		const ss = Number(localNoZone[6] ?? "0");
		return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
	}

	return new Date(s);
}
