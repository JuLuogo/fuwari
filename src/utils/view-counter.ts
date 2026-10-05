import { umamiConfig, viewCounterConfig } from "../config";

/**
 * 浏览量功能是否可用：优先数据源（Umami 分享接口）与兜底数据源（自建 Worker + D1）
 * 任意一个配好就算启用。取数与渲染都在 src/scripts/view-counter-runtime.ts 里。
 */
export function isViewCounterEnabled(): boolean {
	if (!viewCounterConfig.enable) return false;

	const hasSelfHosted = String(viewCounterConfig.endpoint ?? "").trim() !== "";
	const hasUmami =
		!!viewCounterConfig.preferUmami &&
		umamiConfig.enable &&
		!!umamiConfig.shareId &&
		String(umamiConfig.shareApiBase ?? "").trim() !== "";

	return hasSelfHosted || hasUmami;
}
