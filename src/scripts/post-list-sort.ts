// 文章列表客户端排序（仅当前页面内排序）
// 浏览量数据来自 view-counter-runtime.ts 的 "post-views-loaded" 事件（本文件不再自己发请求）

interface PostData {
	id: string;
	title: string;
	published: string;
	/** 有更新时间的文章按它排序，会浮到前面（服务端 getSortedPosts 用同一套口径） */
	updated?: string;
	pinned?: boolean;
}

type SortType = "date" | "views";
type SortOrder = "asc" | "desc";

class PostListManager {
	private posts: PostData[] = [];
	private currentSort: SortType = "date";
	private currentOrder: SortOrder = "desc";
	private articles: HTMLElement[] = [];
	private viewsData: Map<string, number> = new Map();
	private viewsLoaded = false;

	constructor() {
		this.init();
	}

	private init() {
		if (typeof window === "undefined") return;

		this.posts = (window as any).__PAGE_POSTS_DATA__ || [];
		this.cacheArticles();
		this.bindEvents();
		this.subscribeViewsData();
	}

	private cacheArticles() {
		const container = document.getElementById("post-list-container");
		if (!container) return;

		this.articles = Array.from(container.querySelectorAll("article"));
	}

	// 浏览量统一由 view-counter-runtime.ts 拉取（每页一次 POST /batch），这里只消费结果
	private subscribeViewsData() {
		const apply = (views: Record<string, number>) => {
			for (const post of this.posts) {
				this.viewsData.set(post.id, Number(views?.[post.id]) || 0);
			}
			this.viewsLoaded = true;
			if (this.currentSort === "views") this.render();
		};

		const ready = (window as any).__POST_VIEWS__;
		if (ready) {
			apply(ready);
			return;
		}

		window.addEventListener(
			"post-views-loaded",
			((e: Event) => {
				apply((e as CustomEvent).detail?.views ?? {});
			}) as EventListener,
			{ once: true },
		);
	}

	private bindEvents() {
		document.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;

			const sortBtn = target.closest("[data-sort-type]");
			if (sortBtn) {
				e.preventDefault();
				const type = sortBtn.getAttribute("data-sort-type") as SortType;
				this.setSort(type);
				return;
			}

			const orderBtn = target.closest("[data-sort-order]");
			if (orderBtn) {
				e.preventDefault();
				this.toggleOrder();
				return;
			}
		});
	}

	private setSort(type: SortType) {
		if (this.currentSort !== type) {
			this.currentSort = type;
			// 访问量还没回来时先不动 DOM（此时排序结果全是 0，排了也没意义）：
			// subscribeViewsData() 拿到数据后会补一次渲染
			if (type !== "views" || this.viewsLoaded) {
				this.render();
			} else {
				this.updateSortControls();
			}
		}
	}

	private toggleOrder() {
		this.currentOrder = this.currentOrder === "asc" ? "desc" : "asc";
		this.render();
	}

	private getSortedIndices(): number[] {
		const indices = this.posts.map((_, i) => i);

		indices.sort((i, j) => {
			const a = this.posts[i];
			const b = this.posts[j];

			if (this.currentSort === "date") {
				// 置顶优先
				if (a.pinned !== b.pinned) {
					return a.pinned ? -1 : 1;
				}
				// 有更新时间的按更新时间排（改过的文章浮到前面），否则用发布时间
				const dateA = new Date(a.updated ?? a.published).getTime();
				const dateB = new Date(b.updated ?? b.published).getTime();
				return this.currentOrder === "desc" ? dateB - dateA : dateA - dateB;
			} else if (this.currentSort === "views") {
				const viewsA = this.viewsData.get(a.id) || 0;
				const viewsB = this.viewsData.get(b.id) || 0;
				return this.currentOrder === "desc" ? viewsB - viewsA : viewsA - viewsB;
			}

			return 0;
		});

		return indices;
	}

	private render() {
		const container = document.getElementById("post-list-container");
		if (!container || this.articles.length === 0) return;

		const sortedIndices = this.getSortedIndices();

		// 按新顺序重新插入 DOM
		sortedIndices.forEach((index) => {
			if (this.articles[index]) {
				container.appendChild(this.articles[index]);
			}
		});

		this.updateSortControls();
	}

	private updateSortControls() {
		const dateBtn = document.querySelector('[data-sort-type="date"]');
		const viewsBtn = document.querySelector('[data-sort-type="views"]');
		const orderBtn = document.querySelector("[data-sort-order]");

		if (dateBtn && viewsBtn) {
			dateBtn.classList.toggle("active", this.currentSort === "date");
			viewsBtn.classList.toggle("active", this.currentSort === "views");
		}

		if (orderBtn) {
			const icon = orderBtn.querySelector("svg");
			const text = orderBtn.querySelector("span");
			if (icon) {
				icon.classList.toggle("rotate-180", this.currentOrder === "asc");
			}
			if (text) {
				text.textContent = this.currentOrder === "desc" ? "倒序" : "正序";
			}
		}
	}
}

// 初始化
if (typeof window !== "undefined") {
	document.addEventListener("DOMContentLoaded", () => {
		new PostListManager();
	});
}
