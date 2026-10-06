export type SiteConfig = {
	title: string;
	subtitle: string;
	description?: string;
	keywords?: string[];

	lang: string;

	themeColor: {
		hue: number;
		fixed: boolean;
	};
	banner: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url?: string;
		};
	};
	background: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		size?: "cover" | "contain" | "auto";
		repeat?: "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
		attachment?: "fixed" | "scroll" | "local";
		opacity?: number;
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	favicon: Favicon[];
	officialSites?: (string | { url: string; alias: string })[];
	server?: {
		url: string;
		text: string;
	}[];
	customDomain: string; // 博客域名（二级域名），例如 blog.juluo.work
	rootDomain: string; // 根域名，自建服务子域挂在它下面，例如 juluo.work
};

export type Favicon = {
	src: string;
	sizes?: string;
};

export enum LinkPreset {
	Home = 0,
	Archive = 1,
}

export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
	icon?: string;
};

export type NavBarConfig = {
	links: (NavBarLink | LinkPreset)[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type ImageFallbackConfig = {
	enable: boolean;
	originalDomain: string;
	fallbackDomain: string;
};

export type UmamiConfig = {
	enable: boolean;
	baseUrl: string;
	shareId: string;
	websiteId: string;
	timezone: string;
	/** "none" 直出官方代码 / "strictly-necessary" 立即执行 / "tracking" 需用户同意后加载 */
	consentLevel: "none" | "strictly-necessary" | "tracking";
	/**
	 * 分享数据的只读网关（浏览量读取端优先从这里取数）。
	 * Umami 分享页自己就在打这个域：美国区是 https://gateway-us.umami.is；
	 * 留空则不启用「优先 Umami」，直接走 viewCounterConfig.endpoint。
	 */
	shareApiBase?: string;
};

export type ViewCounterConfig = {
	enable: boolean;
	/** 兜底数据源：自建 Worker + D1 的接口地址 */
	endpoint: string;
	/** 优先读 Umami 的分享接口（只读、无需密钥），失败或查不到时回落到 endpoint */
	preferUmami?: boolean;
};

/**
 * 第三方统计（GA4 / Clarity）。
 * consentLevel 控制加载时机：
 *   "none"（本站当前取值）—— 页面一打开就加载，和 Umami、自建计数一致；用户在横幅里选择
 *                            「拒绝」后，会下发停用信号（GA 的 ga-disable-<ID>、Clarity 的
 *                            consent(false)）立即停止后续采集。
 *   "tracking"            —— 渲染成 type="text/plain" + data-cookie-consent="tracking"，
 *                            等用户同意「跟踪」类之后才由 TermsFeed 横幅激活。
 * ⚠️ 无论哪种模式都依赖横幅脚本能跑起来（见 BodyThirdPartyScripts.astro 的注释）。
 */
export type AnalyticsConfig = {
	enable: boolean;
	/** Google Analytics 4 的衡量 ID（G-XXXXXXXXXX）；留空不加载 GA */
	gaMeasurementId?: string;
	/** Microsoft Clarity 的项目 ID；留空不加载 Clarity */
	clarityProjectId?: string;
	/** 加载时机，默认 "none"（立即加载） */
	consentLevel?: "none" | "tracking";
};

export type RandomImageConfig = {
	enable: boolean;
	baseUrl: string;
	/** 横屏图片数量（/ri/h/{n}.webp 的最大 n） */
	max: number;
	/** 竖屏图片数量（/ri/v/{n}.webp 的最大 n），仅画廊页用到 */
	maxVertical: number;
};

export type LinkCardApiConfig = {
	enable: boolean;
	baseUrl: string;
};

export type OneDriveConfig = {
	enable: boolean;
	apiBase: string;
};

export type GiscusConfig = {
	enable: boolean;
	repo: string;
	repoId: string;
	category: string;
	categoryId: string;
	mapping: string;
	lang: string;
	theme: string;
};

export type CookieConsentConfig = {
	enable: boolean;
	siteName: string;
	privacyPolicyUrl: string;
	language: string;
};

export type SiteVerificationConfig = {
	/** Bing 站长验证（msvalidate.01） */
	bing: string;
	/** Google Search Console（google-site-verification） */
	google: string;
	/** 百度站长（baidu-site-verification） */
	baidu: string;
};

export type AiInvolvementLevel = 1 | 2 | 3;

export type BlogPostData = {
	body: string;
	title: string;
	published: Date;
	description: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	ai_level?: AiInvolvementLevel;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
};

export type GitHubEditConfig = {
	enable: boolean;
	baseUrl: string;
};

export type NoticeConfig = {
	enable: boolean;
	level:
		| "info"
		| "note"
		| "tip"
		| "happy"
		| "caution"
		| "warning"
		| "important";
	content: string;
};
