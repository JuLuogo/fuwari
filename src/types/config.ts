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
};

export type ViewCounterConfig = {
	enable: boolean;
	endpoint: string;
};

export type RandomImageConfig = {
	enable: boolean;
	baseUrl: string;
	max: number;
};

export type LinkCardApiConfig = {
	enable: boolean;
	baseUrl: string;
};

export type OneDriveConfig = {
	enable: boolean;
	apiBase: string;
};

export type NatCheckConfig = {
	enable: boolean;
	/** 后端地址，例如 https://nat.juluo.work/api/analyze（该服务需要 UDP，通常得跑在 VPS 上） */
	apiUrl: string;
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
