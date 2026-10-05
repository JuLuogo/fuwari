import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import { defineConfig, passthroughImageService } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeComponents from "rehype-components"; /* Render the custom directive content */
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive"; /* Handle directives */
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";
import { SKIP, visit } from "unist-util-visit";
import { imageFallbackConfig, linkCardApiConfig, siteConfig } from "./src/config.ts";
import { rehypeAIAdmonition } from "./src/plugins/rehype-ai-admonition.mjs";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { UrlCardComponent } from "./src/plugins/rehype-component-url-card.mjs";
import rehypeImageFallback from "./src/plugins/rehype-image-fallback.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js";
import { remarkGithubAdmonitions } from "./src/plugins/remark-github-admonitions.js";
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";

function remarkSpoiler() {
	return (tree) => {
		visit(tree, "paragraph", (node) => {
			const newChildren = [];
			let inSpoiler = false;

			// Check if any child contains '||'
			const hasSpoiler = node.children.some(
				(child) =>
					child.type === "text" && child.value && child.value.includes("||"),
			);

			if (!hasSpoiler) return;

			for (const child of node.children) {
				if (child.type === "text") {
					const parts = child.value.split("||");

					if (parts.length === 1) {
						newChildren.push(child);
						continue;
					}

					parts.forEach((part, index) => {
						if (part) {
							newChildren.push({ type: "text", value: part });
						}

						if (index < parts.length - 1) {
							if (!inSpoiler) {
								newChildren.push({
									type: "html",
									value: '<span class="spoiler" title="点击显示">',
								});
								inSpoiler = true;
							} else {
								newChildren.push({
									type: "html",
									value: "</span>",
								});
								inSpoiler = false;
							}
						}
					});
				} else {
					newChildren.push(child);
				}
			}

			if (inSpoiler) {
				newChildren.push({
					type: "html",
					value: "</span>",
				});
			}

			node.children = newChildren;
			return SKIP;
		});
	};
}

// https://astro.build/config
export default defineConfig({
	image: {
		service: passthroughImageService(),
	},
	site: `https://${siteConfig.customDomain}`,
	prefetch: {
		prefetchAll: true,
		defaultStrategy: "load",
	},
	base: "/",
	output: "static",
	// 需要短链/跳转时在这里添加，例如：
	// redirects: { "/donate": { status: 302, destination: "/sponsors/" } },
	integrations: [
		tailwind({
			nesting: true,
		}),
		svelte({
			compilerOptions: {
				compatibility: {
					componentApi: 4,
				},
			},
		}),
	],
	markdown: {
		syntaxHighlight: false,
		remarkPlugins: [
			remarkSpoiler,
			remarkMath,
			remarkReadingTime,
			remarkExcerpt,
			remarkGithubAdmonitions,
			remarkDirective,
			remarkSectionize,
			parseDirectiveNode,
		],
		rehypePlugins: [
			rehypeKatex,
			rehypeSlug,
			[rehypeImageFallback, imageFallbackConfig],
			[
				rehypeComponents,
				{
					components: {
						github: GithubCardComponent,
						url: (x, y) =>
							UrlCardComponent(x, y, {
								apiBase: linkCardApiConfig.enable
									? linkCardApiConfig.baseUrl
									: "",
							}),
						note: (x, y) => AdmonitionComponent(x, y, "note"),
						tip: (x, y) => AdmonitionComponent(x, y, "tip"),
						important: (x, y) => AdmonitionComponent(x, y, "important"),
						caution: (x, y) => AdmonitionComponent(x, y, "caution"),
						warning: (x, y) => AdmonitionComponent(x, y, "warning"),
						ai: (x, y) => AdmonitionComponent(x, y, "ai"),
					},
				},
			],
			rehypeAIAdmonition,
			[
				rehypeExternalLinks,
				{
					target: "_blank",
				},
			],
			[
				rehypeAutolinkHeadings,
				{
					behavior: "append",
					properties: {
						className: ["anchor"],
					},
					content: {
						type: "element",
						tagName: "span",
						properties: {
							className: ["anchor-icon"],
							"data-pagefind-ignore": true,
						},
						children: [
							{
								type: "text",
								value: "#",
							},
						],
					},
				},
			],
		],
	},
	vite: {
		optimizeDeps: {
			include: [
				"@fancyapps/ui",
				"markdown-it",
				"prismjs",
				"prismjs/components/prism-bash",
				"prismjs/components/prism-typescript",
				"prismjs/components/prism-javascript",
				"prismjs/components/prism-python",
				"prismjs/components/prism-json",
				"prismjs/components/prism-yaml",
				"prismjs/components/prism-toml",
				"prismjs/components/prism-markdown",
				"prismjs/components/prism-css",
				"prismjs/components/prism-scss",
				"prismjs/components/prism-sql",
				"prismjs/components/prism-docker",
				"prismjs/components/prism-nginx",
				"prismjs/components/prism-go",
				"prismjs/components/prism-rust",
				"prismjs/components/prism-java",
				"prismjs/components/prism-c",
				"prismjs/components/prism-cpp",
				"prismjs/components/prism-csharp",
				"prismjs/components/prism-php",
			],
		},
		resolve: {
			alias: [],
		},
		server: {
			allowedHosts: [siteConfig.customDomain, siteConfig.rootDomain],
		},
		build: {
			rollupOptions: {
				onwarn(warning, warn) {
					// temporarily suppress this warning
					if (
						warning.message.includes("is dynamically imported by") &&
						warning.message.includes("but also statically imported by")
					) {
						return;
					}
					warn(warning);
				},
			},
		},
	},
});
