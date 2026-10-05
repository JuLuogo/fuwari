import type { APIRoute } from "astro";

// ⚠️ 这里曾经有一条 `Disallow: /*/`，意思是「屏蔽所有带尾斜杠的路径」——
//    而本站（Astro 默认）**每个页面都是带尾斜杠的 URL**，于是除下面 Allow 里
//    明确列出的几个前缀之外，/privacy/、/tools/*、/timetable/、分页 /2/ … 全被挡在门外；
//    另外原来 Allow 的 /gallery/、/cover/、/changes/ 是照着「浏览量接口里的 pathname」
//    抄的，站点上根本没有这三个路径（真实页面是 /tools/gallery/、/tools/cover/）。
//    结论：默认全放开，只挡构建产物。要让某个页面不进搜索结果，请用页面里的
//    <meta name="robots" content="noindex">，不要用 robots.txt —— 被 disallow 的页面
//    Google 根本读不到那句 noindex，反而会以「被 robots.txt 屏蔽」的形式留在索引里。
const robotsTxt = `
User-agent: *
Allow: /
Disallow: /_astro/

Sitemap: ${new URL("sitemap.xml", import.meta.env.SITE).href}
`.trim();

export const GET: APIRoute = () => {
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
