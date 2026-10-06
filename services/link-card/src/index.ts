/**
 * 链接卡片元数据服务（对应 src/plugins/rehype-component-url-card.mjs）
 *
 *   GET /?url=https://example.com  ->  { url, title, description, image, favicon }
 *
 * 原站（icon.2x.nz）没有开源，这里是按博客插件的接口约定重写的实现。
 */

const MAX_HTML_BYTES = 256 * 1024;
const USER_AGENT =
	"Mozilla/5.0 (compatible; peroe-link-card/1.0; +https://blog.peroe.cn)";

interface Env {
	/** 允许跨域的来源，逗号分隔；默认博客域名 */
	ALLOWED_ORIGINS?: string;
}

interface Meta {
	url: string;
	title: string;
	description: string;
	image: string;
	favicon: string;
}

function decodeEntities(input: string): string {
	return input
		.replace(/&quot;/g, '"')
		.replace(/&#0*39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ")
		.replace(/&#0*38;/g, "&")
		.replace(/&amp;/g, "&");
}

function pick(html: string, patterns: RegExp[]): string {
	for (const re of patterns) {
		const match = re.exec(html);
		const value = match?.[1];
		if (value) return decodeEntities(value.trim());
	}
	return "";
}

function absolutize(base: string, value: string): string {
	if (!value) return "";
	try {
		return new URL(value, base).toString();
	} catch {
		return "";
	}
}

/** 阻止访问内网 / 本机地址（SSRF 防护） */
function isBlockedHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host === "localhost" || host.endsWith(".localhost")) return true;
	if (host === "metadata.google.internal") return true;
	if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
		const [a, b] = host.split(".").map(Number);
		if (a === 10 || a === 127 || a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 192 && b === 168) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
	}
	if (host.startsWith("[") || host.includes(":")) {
		// IPv6 本机 / 链路本地
		if (host === "[::1]" || host.startsWith("[fe80") || host.startsWith("[fc") || host.startsWith("[fd")) {
			return true;
		}
	}
	return false;
}

function corsHeaders(request: Request, env: Env): Headers {
	const headers = new Headers();
	const allowed = (env.ALLOWED_ORIGINS || "https://blog.peroe.cn,https://peroe.cn,https://blog.juluo.work")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const origin = request.headers.get("Origin");
	if (origin && allowed.includes(origin)) {
		headers.set("access-control-allow-origin", origin);
		headers.set("vary", "Origin");
	}
	headers.set("access-control-allow-methods", "GET, OPTIONS");
	headers.set("access-control-allow-headers", "content-type");
	headers.set("access-control-max-age", "86400");
	return headers;
}

function json(data: unknown, status: number, headers: Headers): Response {
	const merged = new Headers(headers);
	merged.set("content-type", "application/json; charset=utf-8");
	return new Response(JSON.stringify(data), { status, headers: merged });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const cors = corsHeaders(request, env);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: cors });
		}
		if (request.method !== "GET") {
			return json({ error: "method_not_allowed" }, 405, cors);
		}

		const target = new URL(request.url).searchParams.get("url");
		if (!target) {
			return json({ error: "missing_url" }, 400, cors);
		}

		let parsed: URL;
		try {
			parsed = new URL(target);
		} catch {
			return json({ error: "invalid_url" }, 400, cors);
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return json({ error: "unsupported_protocol" }, 400, cors);
		}
		if (isBlockedHost(parsed.hostname)) {
			return json({ error: "blocked_host" }, 400, cors);
		}

		let html = "";
		let finalUrl = parsed.toString();
		try {
			const response = await fetch(finalUrl, {
				redirect: "follow",
				headers: {
					"user-agent": USER_AGENT,
					accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
				},
				cf: { cacheTtl: 600, cacheEverything: true },
			} as RequestInit);
			finalUrl = response.url || finalUrl;
			const contentType = response.headers.get("content-type") || "";
			if (!contentType.includes("html") && !contentType.includes("xml") && contentType !== "") {
				return json({ error: "not_html", url: finalUrl }, 415, cors);
			}
			const buffer = await response.arrayBuffer();
			html = new TextDecoder("utf-8").decode(buffer.slice(0, MAX_HTML_BYTES));
		} catch (error) {
			return json(
				{ error: "fetch_failed", url: finalUrl, message: String(error) },
				502,
				cors,
			);
		}

		const head = html.slice(0, MAX_HTML_BYTES);
		const meta: Meta = {
			url: finalUrl,
			title: pick(head, [
				/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
				/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
				/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
				/<title[^>]*>([\s\S]*?)<\/title>/i,
			]),
			description: pick(head, [
				/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
				/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
				/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
				/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
			]),
			image: "",
			favicon: "",
		};

		meta.image = absolutize(
			finalUrl,
			pick(head, [
				/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
				/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
				/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
			]),
		);

		meta.favicon = absolutize(
			finalUrl,
			pick(head, [
				/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i,
				/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i,
			]),
		);
		if (!meta.favicon) {
			meta.favicon = absolutize(finalUrl, "/favicon.ico");
		}
		if (!meta.title) {
			meta.title = finalUrl;
		}

		const out = json(meta, 200, cors);
		out.headers.set("cache-control", "public, max-age=600");
		return out;
	},
};
