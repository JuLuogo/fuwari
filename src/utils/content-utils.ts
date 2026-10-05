import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export async function getSortedPosts(): Promise<CollectionEntry<"posts">[]> {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const sorted = allBlogPosts.sort((a, b) => {
		// 如果一个是置顶一个不是置顶，置顶的排在前面
		if (a.data.pinned !== b.data.pinned) {
			return a.data.pinned ? -1 : 1;
		}
		// 都是置顶或都不是置顶，按「最后更新时间」排（包含小时分钟秒）：
		// 改过的文章会浮到列表最前面，没改过的就用发布时间——和卡片上显示的日期一致。
		// ⚠️ 改文章时要把 frontmatter 的 updated 一起改（带 +08:00），否则它不会提前。
		const dateA = new Date(a.data.updated ?? a.data.published);
		const dateB = new Date(b.data.updated ?? b.data.published);
		return dateA > dateB ? -1 : 1;
	});

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
