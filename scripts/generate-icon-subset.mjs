#!/usr/bin/env node
/**
 * 生成「客户端图标子集」：src/data/icon-subset.json
 *
 * 背景：`IconSvelte.svelte` 是浏览器端组件，如果直接 import 完整的 @iconify-json 数据包，
 * Vite 会把整套图标库（几十 MiB）打进客户端 chunk，Cloudflare Workers 单文件上限 25 MiB 直接部署失败。
 *
 * 所以这里扫描源码里**实际引用到的图标名**，只把它们的 SVG body 抽出来写成一个小 JSON，
 * 客户端组件只 import 这个小文件；服务端组件（Icon.astro）仍可用完整数据包。
 *
 * 用法：node scripts/generate-icon-subset.mjs
 * 触发：astro.config.mjs 里的集成会在每次构建前自动跑一次。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getIconData } from "@iconify/utils";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "data", "icon-subset.json");

/** 与服务端同一份登记表：新增集合时两处一起加 */
const COLLECTIONS = [
	"fa6-brands",
	"fa6-solid",
	"line-md",
	"material-symbols",
	"material-symbols-light",
	"mingcute",
	"mynaui",
	"simple-icons",
	"svg-spinners",
];

/** 明显不是图标名的 `xxx:yyy` 写法（事件名、URL、CSS 变量等） */
const NOT_ICON = new Set([
	"http", "https", "node", "astro", "content", "data", "text", "bg", "var", "url",
	"twitter", "application", "image", "mailto", "tel", "fuwari",
]);

function scanIconNames() {
	const names = new Set();
	const pattern = /["'`]([a-z0-9-]+:[a-z0-9-]+)["'`]/g;
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "content" || entry.name === "data") continue;
				walk(full);
				continue;
			}
			if (!/\.(astro|svelte|ts|tsx|js|mjs)$/.test(entry.name)) continue;
			const text = fs.readFileSync(full, "utf-8");
			for (const m of text.matchAll(pattern)) {
				const name = m[1];
				const prefix = name.split(":")[0];
				if (NOT_ICON.has(prefix)) continue;
				if (!COLLECTIONS.includes(prefix)) continue;
				names.add(name);
			}
		}
	};
	walk(SRC);
	return [...names].sort();
}

const sets = {};
for (const prefix of COLLECTIONS) {
	const file = path.join(ROOT, "node_modules", "@iconify-json", prefix, "icons.json");
	if (fs.existsSync(file)) sets[prefix] = JSON.parse(fs.readFileSync(file, "utf-8"));
}

const names = scanIconNames();
const subset = {};
const missing = [];
for (const name of names) {
	const [prefix, ...rest] = name.split(":");
	const iconName = rest.join(":");
	const set = sets[prefix];
	const data = set ? getIconData(set, iconName) : null;
	if (!data) {
		missing.push(name);
		continue;
	}
	subset[name] = {
		body: data.body,
		width: data.width ?? set.width ?? 24,
		height: data.height ?? set.height ?? 24,
		...(data.left ? { left: data.left } : {}),
		...(data.top ? { top: data.top } : {}),
	};
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(subset, null, "\t")}\n`, "utf-8");

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`[icon-subset] 收集到 ${Object.keys(subset).length} 个图标 -> ${path.relative(ROOT, OUT)} (${kb} KB)`);
if (missing.length) {
	console.warn(`[icon-subset] 以下图标在本地数据包里找不到（客户端会渲染为空，请安装对应 @iconify-json 包）：\n  ${missing.join("\n  ")}`);
}
