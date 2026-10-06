import type { Dirent } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { getCollection } from "astro:content";

interface SitemapPage {
	url: string;
	priority: number;
	changefreq: string;
	lastmod?: Date;
}

/** 构建期把 src/pages 下的页面文件走一遍，得到「这个站真实存在的静态页面 URL」 */
function collectPageUrls(dir: string, prefix = "/"): string[] {
	const urls: string[] = [];
	let entries: Dirent[] = [];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch (error) {
		console.warn(`[sitemap] 读取 ${dir} 失败，跳过一致性校验：${String(error)}`);
		return urls;
	}

	for (const entry of entries) {
		// 动态路由（[...slug]、[week]）和 404 页面不算
		if (entry.name.includes("[")) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			urls.push(...collectPageUrls(full, `${prefix}${entry.name}/`));
			continue;
		}
		if (!entry.name.endsWith(".astro") || entry.name === "404.astro") continue;
		const base = entry.name.replace(/\.astro$/, "");
		urls.push(base === "index" ? prefix : `${prefix}${base}/`);
	}
	return urls;
}

// 清单里写了不存在的路径 → 构建日志里告警。之前 sitemap 里挂过 /gallery/、/changes/
// 两个 404 的地址，就是靠人工记忆手写清单写歪的，这个校验专门防它复发。
const pageUrls = new Set(collectPageUrls(join(process.cwd(), "src", "pages")));
// 首页是动态路由 [...page].astro（分页第 1 页）渲染的，扫描扫不到，手动登记
pageUrls.add("/");

/**
 * 生成站点地图 XML。`/sitemap.xml` 与备用路径 `/sitemap-1.xml` 共用这一份实现，
 * 保证两边内容永远一致（备用路径是给 Google Search Console 做 A/B 排查用的）。
 */
export async function buildSitemapXml(site: string | URL): Promise<string> {
	// 加密文章不进站点地图（正文不对搜索引擎开放）
	const posts = await getCollection("posts", ({ data }) => {
		return !data.draft && data.encrypted !== true;
	});

	// 只放「读者从导航点得到、值得被收录」的页面；工具页里的生成器（/tools/cover/ 等）
	// 是可交互的小工具、正文很薄，不进站点地图（但 robots.txt 不挡它们，仍可被抓取）。
	const staticPages: SitemapPage[] = [
		{ url: "/", priority: 1.0, changefreq: "daily" },
		{ url: "/archive/", priority: 0.8, changefreq: "weekly" },
		{ url: "/tools/", priority: 0.6, changefreq: "monthly" },
		{ url: "/tools/gallery/", priority: 0.6, changefreq: "monthly" },
		{ url: "/friends/", priority: 0.6, changefreq: "monthly" },
		{ url: "/sponsors/", priority: 0.5, changefreq: "monthly" },
		{ url: "/timetable/", priority: 0.5, changefreq: "monthly" },
		{ url: "/privacy/", priority: 0.3, changefreq: "yearly" },
	];

	for (const page of staticPages) {
		if (!pageUrls.has(page.url)) {
			console.warn(
				`[sitemap] 清单里的 ${page.url} 在 src/pages 下找不到对应页面，可能是 404 —— 请检查 src/utils/sitemap.ts。` +
					`（本次共识别到 ${pageUrls.size} 个页面：${[...pageUrls].join(" ")}）`,
			);
		}
	}

	const postPages: SitemapPage[] = posts.map((post) => ({
		url: `/posts/${post.id}/`,
		priority: 0.7,
		changefreq: "weekly",
		lastmod: post.data.updated || post.data.published,
	}));

	const allPages: SitemapPage[] = [...staticPages, ...postPages];

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
	.map((page) => {
		const loc = `	<loc>${new URL(page.url, site).href}</loc>`;
		const priority = `	<priority>${page.priority}</priority>`;
		const changefreq = `	<changefreq>${page.changefreq}</changefreq>`;
		const lastmod = page.lastmod
			? `	<lastmod>${new Date(page.lastmod).toISOString().split("T")[0]}</lastmod>`
			: "";
		return `	<url>
${loc}
${priority}
${changefreq}${lastmod ? `\n${lastmod}` : ""}
	</url>`;
	})
	.join("\n")}
</urlset>`.trim();
}

export const SITEMAP_HEADERS = {
	"Content-Type": "application/xml; charset=utf-8",
} as const;
