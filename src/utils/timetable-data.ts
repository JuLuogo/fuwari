import fs from "node:fs";
import path from "node:path";

/** 课表数据目录：把导出的课表 JSON 放进来即可，自动使用第一个文件 */
export const TIMETABLE_DIR = "src/data/timetable";

/**
 * 解析当前使用的课表文件（相对仓库根目录的路径）。
 * 目录不存在或没有 JSON 时返回空字符串。
 */
export function resolveTimetableFile(): string {
	const absoluteDir = path.join(process.cwd(), TIMETABLE_DIR);
	if (!fs.existsSync(absoluteDir)) return "";

	const files = fs
		.readdirSync(absoluteDir)
		.filter((file) => file.toLowerCase().endsWith(".json"))
		.sort();

	return files.length ? `${TIMETABLE_DIR}/${files[0]}` : "";
}
