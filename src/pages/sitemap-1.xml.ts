import type { APIRoute } from "astro";
import { buildSitemapXml, SITEMAP_HEADERS } from "../utils/sitemap";

// 备用站点地图：内容与 /sitemap.xml 完全一致（同一份 buildSitemapXml），
// 存在的唯一原因是排查 Google Search Console 里 /sitemap.xml 一直报「无法抓取」的问题 ——
// 站点侧所有检查都通过（200 / 合法 XML / 无重定向 / robots 不挡 / DNS 三个解析器一致 /
// 第三方网络也能抓），而同域的 /rss.xml 在 GSC 里是「成功」，所以怀疑是 Google 侧
// 针对这个路径的陈旧失败记录。把这条也提交给 GSC 做 A/B：
//   - 备用路径能抓、原路径还不行 → 是路径级的陈旧记录，把 robots.txt 的 Sitemap 指向能用的那条即可；
//   - 两条都抓不了 → 问题不在路径上，回去查 Cloudflare 的 Security Events 与 GSC 的错误详情。
// 排查结束后这个文件可以直接删掉。
export const GET: APIRoute = async () => {
	const sitemap = await buildSitemapXml(import.meta.env.SITE);
	return new Response(sitemap, { headers: SITEMAP_HEADERS });
};
