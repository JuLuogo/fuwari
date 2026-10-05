/**
 * 构建期把 Iconify 图标解析成**内联 SVG**。
 *
 * 为什么不用 `https://api.iconify.design/...` 的 mask-image 方案：
 * 那会让每个图标都变成一次外部请求，一旦访问不到该域名（例如国内网络），
 * 全站图标会集体消失、布局跟着错乱。这里改成从本地 `@iconify-json/*` 数据包读取，
 * 在构建时就把 SVG 内联进 HTML —— **运行时零外部请求**。
 *
 * 新增图标集合时：安装 `@iconify-json/<collection>` 并在下面登记。
 * 图标名格式为 `<collection>:<icon-name>`，与 Iconify 官方一致。
 */
import { getIconData, iconToSVG } from "@iconify/utils";

import fa6Brands from "@iconify-json/fa6-brands/icons.json";
import fa6Solid from "@iconify-json/fa6-solid/icons.json";
import lineMd from "@iconify-json/line-md/icons.json";
import materialSymbols from "@iconify-json/material-symbols/icons.json";
import materialSymbolsLight from "@iconify-json/material-symbols-light/icons.json";
import mingcute from "@iconify-json/mingcute/icons.json";
import mynaui from "@iconify-json/mynaui/icons.json";
import simpleIcons from "@iconify-json/simple-icons/icons.json";
import svgSpinners from "@iconify-json/svg-spinners/icons.json";

/** 图标集合的 JSON 结构由 @iconify-json/* 提供，这里只做结构类型约束 */
type IconSet = Parameters<typeof getIconData>[0];

const SETS: Record<string, IconSet> = {
	"fa6-brands": fa6Brands as IconSet,
	"fa6-solid": fa6Solid as IconSet,
	"line-md": lineMd as IconSet,
	"material-symbols": materialSymbols as IconSet,
	"material-symbols-light": materialSymbolsLight as IconSet,
	mingcute: mingcute as IconSet,
	mynaui: mynaui as IconSet,
	"simple-icons": simpleIcons as IconSet,
	"svg-spinners": svgSpinners as IconSet,
};

/** 已解析过的图标缓存（构建期会多次请求同一图标） */
const cache = new Map<string, string | null>();
const missing = new Set<string>();

/**
 * 把 `collection:icon-name` 解析成一段 `<svg>` 字符串。
 * 找不到时返回 `null`，并记录一次（构建日志里会汇总提示）。
 */
export function iconSvg(name: string): string | null {
	if (!name) return null;
	const cached = cache.get(name);
	if (cached !== undefined) return cached;

	const [prefix, ...rest] = name.split(":");
	const iconName = rest.join(":");
	const set = SETS[prefix];

	let svg: string | null = null;
	if (set && iconName) {
		const data = getIconData(set, iconName);
		if (data) {
			const { attributes, body } = iconToSVG(data, { height: "1em" });
			svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="${attributes.viewBox}" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
		}
	}

	if (!svg && !missing.has(name)) {
		missing.add(name);
		console.warn(
			`[icon] 本地图标数据里找不到 "${name}"：请安装 @iconify-json/${prefix} 并在 src/utils/icon-svg.ts 里登记，或改正图标名`,
		);
	}

	cache.set(name, svg);
	return svg;
}

/** 构建结束后可用来核对「哪些图标没解析成功」 */
export function missingIcons(): string[] {
	return [...missing];
}
