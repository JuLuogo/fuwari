import { getSortedPosts } from "@/utils/content-utils";
import { publicPosts } from "@/utils/post-visibility";
import type { APIContext } from "astro";

function toPlainText(markdown: string): string {
	return markdown
		.replace(/!\[[^\]]*]\([^)]*\)/g, " ")
		.replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/[#>*_\-~]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export async function GET(_context: APIContext): Promise<Response> {
	// 加密文章必须排除：索引会把正文压成纯文本写进产物
	const posts = publicPosts(await getSortedPosts());
	const payload = posts.map((post) => ({
		title: post.data.title || "",
		description: post.data.description || "",
		content: toPlainText(post.body || ""),
		link: post.id,
		published: post.data.published || "",
	}));

	return new Response(JSON.stringify(payload), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=600",
		},
	});
}
