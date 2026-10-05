<script lang="ts">
	import { iconSvg } from "@utils/icon-svg";

	export let icon: string = "";
	let className: string = "";
	export { className as class };
	export let width: string | number = "1em";
	export let height: string | number = "1em";
	export let style: string = "";

	// 构建期就把图标解析成内联 SVG（运行时零外部请求，见 src/utils/icon-svg.ts）
	$: svg = iconSvg(icon);
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
