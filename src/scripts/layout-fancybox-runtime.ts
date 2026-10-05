import { bindFancybox, cleanupFancybox } from "@utils/fancybox";

const SELECTOR = ".custom-md img, #post-cover img";

function initFancybox() {
	cleanupFancybox();
	bindFancybox(SELECTOR);
}

// 初始加载
initFancybox();

// 加密文章解锁后正文图片是运行时注入的，需要重新绑定一次
window.addEventListener("fuwari:images-injected", () => {
	initFancybox();
});

window.addEventListener("keydown", (e) => {
	if (e.key !== "Escape") return;
});
