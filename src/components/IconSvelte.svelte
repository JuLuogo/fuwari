<script lang="ts">
	import subset from "@/data/icon-subset.json";

	export let icon: string = "";
	let className: string = "";
	export { className as class };
	export let width: string | number = "1em";
	export let height: string | number = "1em";
	export let style: string = "";

	// ⚠️ 这个组件会打包进浏览器端，所以只能引用「图标子集」（src/data/icon-subset.json），
	// 不能 import 完整的 @iconify-json 数据包（那会把几十 MiB 塞进客户端 chunk）。
	// 子集由 scripts/generate-icon-subset.mjs 在构建前扫描源码自动生成。
	type Entry = { body: string; width: number; height: number; left?: number; top?: number };
	const SUBSET = subset as Record<string, Entry>;

	function render(name: string): string | null {
		const data = SUBSET[name];
		if (!data) return null;
		const left = data.left ?? 0;
		const top = data.top ?? 0;
		return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="${left} ${top} ${data.width} ${data.height}" fill="currentColor" aria-hidden="true" focusable="false">${data.body}</svg>`;
	}

	// 构建（SSR）时算一次；客户端水合时用同一份子集算，结果一致
	$: svg = render(icon);
	$: sizeStyle = `width: ${typeof width === "number" ? `${width}px` : width}; height: ${
		typeof height === "number" ? `${height}px` : height
	};`;
</script>

<span
	class:list={["iconify-icon", className]}
	data-icon={icon}
	style="{sizeStyle} {style}"
	{...$$restProps}
>
	{#if svg}{@html svg}{/if}
</span>

<style>
	.iconify-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		vertical-align: -0.125em;
	}

	.iconify-icon :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
