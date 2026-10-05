import type { CollectionEntry } from "astro:content";

/**
 * 加密文章（单篇密码保护）的统一判定入口。
 *
 * 注意：不要在 content-utils.ts 的 getSortedPosts() 里过滤加密文章 ——
 * 它会原地改写 data.prevSlug/nextSlug，对共享缓存对象过滤后再排序会让 prev/next 错乱。
 * 需要「排除加密文章」时，在这里过滤。
 */
export function isEncrypted(post: CollectionEntry<"posts">): boolean {
	return post.data.encrypted === true;
}

/** 过滤掉加密文章（正文不可公开，不能进 RSS / 搜索索引 / 站点地图 / 字数统计） */
export function publicPosts(
	posts: CollectionEntry<"posts">[],
): CollectionEntry<"posts">[] {
	return posts.filter((post) => !isEncrypted(post));
}
