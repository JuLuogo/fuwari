// 浏览量的统一读取端：每个页面只发一次 POST /batch，同时把「全站访问量」与各篇文章的浏览量回填到 DOM。
//
// 需要展示哪些文章由页面自己登记：
//   - 列表页：__PAGE_POSTS_DATA__（[...page].astro 注入的整页文章数据）
//   - 其它页面：__VIEWS_QUEUE__（PostMeta 每渲染一次就 push 一个 slug）
// 取数口径固定为 ["/", "/posts/<slug>/", ...]，响应里的第 0 项是全站访问量（即首页的 PV）。
//
// 写入端（上报）不在这里：各页面引用的 tracker.js 负责 POST /send，
// 见 components/layout/BodyThirdPartyScripts.astro。只读不写的话所有数字都会恒为 0。
import { viewCounterConfig } from "../config";

const SITE_VIEWS_EVENT = "site-views-loaded";
const POST_VIEWS_EVENT = "post-views-loaded";
const SITE_PATHNAME = "/";

type ViewsMap = Record<string, number>;

function getEndpoint(): string {
	if (!viewCounterConfig.enable) return "";
	return String(viewCounterConfig.endpoint ?? "")
		.trim()
		.replace(/\/+$/, "");
}

function collectSlugs(): string[] {
	const pageData = (window as any).__PAGE_POSTS_DATA__;
	const raw: unknown[] =
		Array.isArray(pageData) && pageData.length > 0
			? pageData.map((post: { id?: unknown }) => post?.id)
			: ((window as any).__VIEWS_QUEUE__ ?? []);

	const slugs = raw.filter(
		(slug): slug is string => typeof slug === "string" && slug.length > 0,
	);
	return [...new Set(slugs)];
}

function setSiteViews(views: number) {
	(window as any).__SITE_VIEWS__ = views;

	const element = document.getElementById("site-views");
	const wrapper = document.getElementById("site-views-wrapper");
	if (element && wrapper) {
		element.textContent = views.toString();
		wrapper.style.display = "grid";
	}

	window.dispatchEvent(
		new CustomEvent(SITE_VIEWS_EVENT, { detail: { views } }),
	);
}

function setPostViews(slug: string, views: number) {
	const element = document.getElementById(`page-views-${slug}`);
	const wrapper = document.getElementById(`page-views-wrapper-${slug}`);
	if (element && wrapper) {
		element.textContent = `${views} 次`;
		wrapper.style.display = "flex";
	}
}

async function loadViews() {
	const endpoint = getEndpoint();
	if (!endpoint) return;

	const slugs = collectSlugs();
	const pathnames = [SITE_PATHNAME, ...slugs.map((slug) => `/posts/${slug}/`)];

	try {
		const res = await fetch(`${endpoint}/batch`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(pathnames),
		});
		if (!res.ok) return;

		const views: unknown = await res.json();
		if (!Array.isArray(views)) return;

		setSiteViews(Number(views[0]) || 0);

		const map: ViewsMap = {};
		slugs.forEach((slug, index) => {
			const count = Number(views[index + 1]) || 0;
			map[slug] = count;
			setPostViews(slug, count);
		});

		(window as any).__POST_VIEWS__ = map;
		window.dispatchEvent(
			new CustomEvent(POST_VIEWS_EVENT, { detail: { views: map } }),
		);
	} catch {
		// 请求失败就保持隐藏：宁可什么都不显示，也不显示一个假的 0
	} finally {
		(window as any).__VIEWS_FETCHED__ = true;
	}
}

if (typeof window !== "undefined") {
	// 本脚本是模块（defer），执行时 DOM 已解析完，PostMeta 的内联登记脚本也已跑过
	void loadViews();
}
