import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { parsePostDateToDate } from "./utils/date-utils";

// 注意：这里不要给集合加 `ReturnType<typeof defineCollection>` 之类的显式标注，
// 否则会把 schema 类型擦成 unknown，导致 CollectionEntry<"posts">["data"] 全站变成 unknown。
const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.preprocess(parsePostDateToDate, z.date()),
		updated: z.preprocess(parsePostDateToDate, z.date()).optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		ai_level: z.number().int().min(1).max(3).optional(),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({
		enable: z.boolean().optional().default(true),
		level: z.string().optional().default("info"),
	}),
});

// 刻意保留类型推断：它决定 CollectionEntry<"posts">["data"] 是否带完整字段类型。
// （不要加显式类型标注，也不要把 tsconfig 的 declaration 打开，否则会退化成 unknown / TS2742）
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
