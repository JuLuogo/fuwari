import type { MarkdownHeading } from "astro";

export interface TocItem extends MarkdownHeading {
	children: TocItem[];
}

/** 把扁平的 headings 折成 TOC 树（与 TOC.astro 原实现一致，抽出来给客户端重建复用） */
export function buildTocTree(headings: MarkdownHeading[]): TocItem[] {
	const toc: TocItem[] = [];
	const parentStack: TocItem[] = [];

	for (const h of headings) {
		const item: TocItem = {
			...h,
			text: removeTailingHash(h.text),
			children: [],
		};

		while (
			parentStack.length > 0 &&
			parentStack[parentStack.length - 1].depth >= item.depth
		) {
			parentStack.pop();
		}

		if (parentStack.length > 0) {
			parentStack[parentStack.length - 1].children.push(item);
		} else {
			toc.push(item);
		}
		parentStack.push(item);
	}

	return toc;
}

export function removeTailingHash(text: string): string {
	const lastIndexOfHash = text.lastIndexOf("#");
	if (lastIndexOfHash !== text.length - 1) {
		return text;
	}

	return text.substring(0, lastIndexOfHash);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function badgeHtml(level: number, index: number): string {
	if (level === 1) {
		return '<div class="transition w-2 h-2 rounded-[0.1875rem] bg-[var(--toc-badge-bg)]"></div>';
	}
	if (level === 2) {
		return '<div class="transition w-1.5 h-1.5 rounded-sm bg-white/10"></div>';
	}
	if (level > 2) {
		return '<div class="transition w-1 h-1 rounded-sm bg-white/10"></div>';
	}
	return String(index + 1);
}

/**
 * 生成与 components/widget/TOCList.astro 完全同构的 TOC 列表 HTML。
 * 加密文章在服务端拿不到 headings（传 []），解锁后由浏览器用这份 HTML 重建侧栏目录，
 * 所以这里的 class 必须和 TOCList.astro 保持一致。
 */
export function renderTocListHtml(items: TocItem[], level = 0): string {
	if (items.length === 0) return "";

	const listTag = level === 0 ? "ol" : "ul";
	const listClass = level === 0 ? "space-y-1" : "pl-4 space-y-1";

	const lis = items
		.map((item, index) => {
			const badgeClass = [
				"transition w-5 h-5 shrink-0 rounded-lg text-xs flex items-center justify-center font-bold",
				level === 0 ? "bg-[var(--toc-badge-bg)] text-[var(--btn-content)]" : "",
			]
				.filter(Boolean)
				.join(" ");
			const textClass = [
				"transition text-sm min-w-0 flex-1 break-words",
				level === 0 || level === 1 ? "text-50" : "text-30",
			].join(" ");

			const children = renderTocListHtml(item.children, level + 1);

			return `<li><a href="#${escapeHtml(item.slug)}" class="px-2 flex gap-2 relative transition w-full min-h-9 rounded-xl hover:bg-[var(--toc-btn-hover)] active:bg-[var(--toc-btn-active)] py-2"><div class="${badgeClass}">${badgeHtml(level, index)}</div><div class="${textClass}">${escapeHtml(item.text)}</div></a>${children}</li>`;
		})
		.join("");

	return `<${listTag} class="${listClass}">${lis}</${listTag}>`;
}
