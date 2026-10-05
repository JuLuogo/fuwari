import type {
	CookieConsentConfig,
	GitHubEditConfig,
	GiscusConfig,
	ImageFallbackConfig,
	LicenseConfig,
	LinkCardApiConfig,
	NatCheckConfig,
	NavBarConfig,
	OneDriveConfig,
	ProfileConfig,
	RandomImageConfig,
	SiteConfig,
	UmamiConfig,
	ViewCounterConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

// 根域名：自建服务的子域都挂在它下面（p./t./icon./nat./img. 等）
const rootDomain = "juluo.work";

// 博客使用二级域名，根域保持空闲（想换成 www 就改这一行）
const blogSubdomain = "blog";
const customDomain = `${blogSubdomain}.${rootDomain}`;

// 个人 QQ（头像与联系入口都由它推导，换号只需改这一处）
const qqNumber = "1576586736";
const qqAvatar = `https://q2.qlogo.cn/headimg_dl?dst_uin=${qqNumber}&spec=0`;

// TODO: 换成你自己的邮箱地址（当前为占位符）
const contactEmail = `juluo@${rootDomain}`;

export const siteConfig: SiteConfig = {
	customDomain,
	rootDomain,
	title: "peroe 的博客",
	subtitle: "juluo",
	description:
		"peroe 的个人博客，记录技术折腾、开发笔记与生活碎片，欢迎来玩。",

	keywords: [
		"peroe",
		"peroe 的博客",
		"juluo",
		"juluo.work",
		"个人博客",
		"技术博客",
		"Blog",
	],
	lang: "zh_CN", // 'en', 'zh_CN', 'zh_TW', 'ja', 'ko', 'es', 'th'
	themeColor: {
		hue: 255, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: true, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "", // 放自己的图后填 '/xxx.avif'（public 目录）或完整 URL

		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed

			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	background: {
		enable: false, // Enable background image
		src: "", // Background image URL (supports HTTPS)
		position: "center", // Background position: 'top', 'center', 'bottom'
		size: "cover", // Background size: 'cover', 'contain', 'auto'
		repeat: "no-repeat", // Background repeat: 'no-repeat', 'repeat', 'repeat-x', 'repeat-y'
		attachment: "fixed", // Background attachment: 'fixed', 'scroll', 'local'
		opacity: 1, // Background opacity (0-1)
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		{
			src: qqAvatar, // Path of the favicon, relative to the /public directory
			//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		},
	],
	server: [],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "友链",
			url: "/friends/",
			external: false,
			icon: "material-symbols:group-outline-rounded",
		},
		{
			name: "赞助",
			url: "/sponsors/",
			external: false,
			icon: "material-symbols:volunteer-activism-outline-rounded",
		},
		{
			name: "工具",
			url: "/tools/",
			external: false,
			icon: "material-symbols:build-outline-rounded",
		},
		{
			name: "统计",
			url: `https://cloud.umami.is/analytics/us/share/${"JqAx99f9Wf6jWaGl"}`,
			external: true,
			icon: "material-symbols:table-chart",
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: qqAvatar, // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "peroe",
	bio: "记录折腾与生活。",
	links: [
		{
			name: "QQ",
			icon: "simple-icons:qq",
			url: `https://wpa.qq.com/msgrd?v=3&uin=${qqNumber}&site=qq&menu=yes`,
		},
		{
			name: "GitHub",
			icon: "simple-icons:github",
			url: "https://github.com/juluogo",
		},
		{
			name: "Email",
			icon: "material-symbols:mail-outline-rounded",
			url: `mailto:${contactEmail}`,
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const imageFallbackConfig: ImageFallbackConfig = {
	enable: false,
	originalDomain: `https://p.${rootDomain}`,
	fallbackDomain: `https://p.${rootDomain}`,
};

// Umami 统计（Umami Cloud 美国区）
// 后台：https://cloud.umami.is
// 分享页：https://cloud.umami.is/analytics/us/share/JqAx99f9Wf6jWaGl
// 官方追踪代码：
//   <script defer src="https://cloud.umami.is/script.js" data-website-id="842d980c-5e11-4834-a2a8-5daaa285ce66"></script>
// consentLevel 三种取值：
//   "none"                → 直出上面的官方代码，不接 Cookie 同意（始终统计，默认，行为与官方一致）
//   "strictly-necessary"  → 归入「严格必要」类，横幅加载后立即执行
//   "tracking"            → 归入「跟踪」类，用户同意后才加载（以后加了 GA 之类的选这个）
export const umamiConfig: UmamiConfig = {
	enable: true,
	baseUrl: "https://cloud.umami.is",
	shareId: "JqAx99f9Wf6jWaGl",
	websiteId: "842d980c-5e11-4834-a2a8-5daaa285ce66",
	timezone: "Asia/Shanghai",
	consentLevel: "none",
};

// 文章/页面浏览量：自建统计服务（Cloudflare Worker + D1，部署在 t.juluo.work）
export const viewCounterConfig: ViewCounterConfig = {
	enable: true,
	endpoint: "https://t.juluo.work",
};

// 随机图 API：自建后把 enable 打开并填写地址（例如 https://p.juluo.work），
// 图片需按 /ri/h/{n}.webp 存放，/count.json 返回 { "h": 总数 }
export const randomImageConfig: RandomImageConfig = {
	enable: false,
	baseUrl: "",
	max: 0,
};

// 链接卡片（::url{}）的元数据 API：自建 Worker 部署在 icon.juluo.work（代码见 services/link-card）
export const linkCardApiConfig: LinkCardApiConfig = {
	enable: true,
	baseUrl: "https://icon.juluo.work",
};

// Cookie 同意（TermsFeed 免费版）：站点名与隐私政策地址会显示在横幅里
export const cookieConsentConfig: CookieConsentConfig = {
	enable: true,
	siteName: "peroe 的博客",
	privacyPolicyUrl: `https://${customDomain}/privacy/`,
	// 语言代码见 TermsFeed i18n，改动前先在浏览器里确认横幅文案正常
	language: "zh-TW",
};

// Giscus 评论：仓库需开启 Discussions，并在仓库上安装 GitHub App https://github.com/apps/giscus
export const giscusConfig: GiscusConfig = {
	enable: true,
	repo: "juluogo/giscus",
	repoId: "R_kgDOPdSugg",
	category: "Announcements",
	categoryId: "DIC_kwDOPdSugs4CuINO",
	mapping: "pathname",
	lang: "zh-CN",
	theme: `https://${customDomain}/css/giscus.css`,
};

// NAT 类型检测后端：原站后端是 Python + Docker（Twin-Server STUN，需要 UDP 端口），
// Cloudflare Worker 无法承载；有 VPS 时把地址填进来并把 enable 打开
export const natCheckConfig: NatCheckConfig = {
	enable: false,
	apiUrl: "",
};

// OneDrive / 对象存储文件索引（工具页的 OneDrive 标签页）：自建后填写
export const oneDriveConfig: OneDriveConfig = {
	enable: false,
	apiBase: `https://e3.${rootDomain}/api/`,
};

export const gitHubEditConfig: GitHubEditConfig = {
	enable: true,
	baseUrl: "https://github.com/juluogo/fuwari/blob/main/src/content/posts",
};

// todoConfig removed from here
