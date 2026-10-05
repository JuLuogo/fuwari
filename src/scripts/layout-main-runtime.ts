import { siteConfig } from "../config";
import {
	BANNER_HEIGHT,
	BANNER_HEIGHT_EXTEND,
	BANNER_HEIGHT_HOME,
	MAIN_PANEL_OVERLAPS_BANNER_HEIGHT,
} from "../constants/constants";
import { bindPostInlineDiff } from "../scripts/post-inline-diff";

const bannerEnabled = !!document.getElementById("banner-wrapper");

function setClickOutsideToClose(panel: string, ignores: string[]) {
	document.addEventListener("click", (event) => {
		const panelDom = document.getElementById(panel);
		if (!panelDom) return;
		const tDom = event.target;
		if (!(tDom instanceof Node)) return;
		for (const ig of ignores) {
			const ie = document.getElementById(ig);
			if (ie == tDom || ie?.contains(tDom)) {
				return;
			}
		}
		panelDom.classList.add("float-panel-closed");
	});
}
setClickOutsideToClose("nav-menu-panel", ["nav-menu-panel", "nav-menu-switch"]);
setClickOutsideToClose("search-panel", [
	"search-panel",
	"search-bar",
	"search-bar-mobile",
	"search-bar-inside",
	"search-switch",
]);

function showBanner() {
	if (!siteConfig.banner.enable) return;

	const banner = document.getElementById("banner");
	if (!banner) {
		console.error("Banner element not found");
		return;
	}

	banner.classList.remove("opacity-0", "scale-105");
}

function loadProfileStats() {
	const viewsElement = document.getElementById("site-views");
	const wrapper = document.getElementById("site-views-wrapper");
	if (!viewsElement) return;

	// 如果已经有数据（transition:persist 保留的），直接显示 wrapper
	if (viewsElement.textContent && viewsElement.textContent.trim() !== "") {
		if (wrapper) wrapper.style.display = "grid";
		return;
	}

	// 监听自定义事件
	window.addEventListener('site-views-loaded', (e: Event) => {
		const customEvent = e as CustomEvent;
		const siteViews = customEvent.detail.views;
		viewsElement.textContent = siteViews.toString();
		if (wrapper) wrapper.style.display = "grid";
	}, { once: true });
	
	// 如果已经有数据，直接使用
	if ((window as any).__SITE_VIEWS__ !== undefined) {
		viewsElement.textContent = (window as any).__SITE_VIEWS__.toString();
		if (wrapper) wrapper.style.display = "grid";
	}
}

function init() {
	showBanner();
	loadProfileStats();

	new MutationObserver(() => {
		const frame = document.querySelector<HTMLIFrameElement>(
			"iframe.giscus-frame",
		);
		if (!frame || !frame.contentWindow) return;
		frame.contentWindow.postMessage(
			{ giscus: { setConfig: { theme: "dark" } } },
			"https://giscus.app",
		);
	}).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
}

// 初始加载时执行
document.addEventListener("DOMContentLoaded", () => {
	init();
	bindPostInlineDiff();
	scrollFunction();
});

let backToTopBtn = document.getElementById("back-to-top-btn");
let goToCommentsBtn = document.getElementById("go-to-comments-btn");
let toc = document.getElementById("toc-wrapper");
let navbar = document.getElementById("navbar-wrapper");
function refreshControlRefs() {
	backToTopBtn = document.getElementById("back-to-top-btn");
	goToCommentsBtn = document.getElementById("go-to-comments-btn");
	toc = document.getElementById("toc-wrapper");
	navbar = document.getElementById("navbar-wrapper");
}
function scrollFunction() {
	refreshControlRefs();
	const bannerHeight = window.innerHeight * (BANNER_HEIGHT / 100);

	if (backToTopBtn) {
		if (
			document.body.scrollTop > bannerHeight ||
			document.documentElement.scrollTop > bannerHeight
		) {
			backToTopBtn.classList.remove("hide");
		} else {
			backToTopBtn.classList.add("hide");
		}
	}

	if (goToCommentsBtn) {
		const commentsExist = !!document.getElementById("giscus-container");
		if (commentsExist) {
			goToCommentsBtn.classList.remove("hide");
		} else {
			goToCommentsBtn.classList.add("hide");
		}
	}

	if (bannerEnabled && toc) {
		if (
			document.body.scrollTop > bannerHeight ||
			document.documentElement.scrollTop > bannerHeight
		) {
			toc.classList.remove("toc-hide");
		} else {
			toc.classList.add("toc-hide");
		}
	}

	if (!bannerEnabled) return;
	if (navbar) {
		const NAVBAR_HEIGHT = 72;
		const MAIN_PANEL_EXCESS_HEIGHT = MAIN_PANEL_OVERLAPS_BANNER_HEIGHT * 16;

		let bannerHeight = BANNER_HEIGHT;
		if (
			document.body.classList.contains("lg:is-home") &&
			window.innerWidth >= 1024
		) {
			bannerHeight = BANNER_HEIGHT_HOME;
		}
		const threshold =
			window.innerHeight * (bannerHeight / 100) -
			NAVBAR_HEIGHT -
			MAIN_PANEL_EXCESS_HEIGHT -
			16;
		if (
			document.body.scrollTop >= threshold ||
			document.documentElement.scrollTop >= threshold
		) {
			navbar.classList.add("navbar-hidden");
		} else {
			navbar.classList.remove("navbar-hidden");
		}
	}
}
window.onscroll = () => {
	scrollFunction();
};
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		scrollFunction();
	});
} else {
	scrollFunction();
}

window.onresize = () => {
	let offset = Math.floor(window.innerHeight * (BANNER_HEIGHT_EXTEND / 100));
	offset = offset - (offset % 4);
	document.documentElement.style.setProperty(
		"--banner-height-extend",
		`${offset}px`,
	);
};