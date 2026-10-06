import type { APIRoute } from "astro";
import { buildSitemapXml, SITEMAP_HEADERS } from "../utils/sitemap";

export const GET: APIRoute = async () => {
	const sitemap = await buildSitemapXml(import.meta.env.SITE);
	return new Response(sitemap, { headers: SITEMAP_HEADERS });
};
