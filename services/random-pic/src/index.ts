/**
 * 随机图 API（对应博客的 randomImageConfig）
 *
 *   GET /count.json        -> { "h": 横屏数量, "v": 竖屏数量 }
 *   GET /random?type=h|v   -> 302 跳到随机一张图
 *   GET /ri/h/{n}.webp     -> 直接从 R2 桶返回图片
 *
 * 图片放在 R2 桶（默认桶名 juluo）的 ri/h/ 与 ri/v/ 前缀下，
 * 命名沿用原站规则：ri/h/1.webp、ri/h/2.webp …
 */

interface Env {
	BUCKET: R2Bucket;
	/** 允许跨域的来源，逗号分隔 */
	ALLOWED_ORIGINS?: string;
}

const IMAGE_PREFIX = "ri/";

function corsHeaders(request: Request, env: Env): Headers {
	const headers = new Headers();
	const allowed = (env.ALLOWED_ORIGINS || "https://blog.juluo.work,https://juluo.work")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const origin = request.headers.get("Origin");
	if (origin && allowed.includes(origin)) {
		headers.set("access-control-allow-origin", origin);
		headers.set("vary", "Origin");
	}
	return headers;
}

async function countPrefix(env: Env, prefix: string): Promise<number> {
	let cursor: string | undefined;
	let total = 0;
	do {
		const listed = await env.BUCKET.list({ prefix, cursor, limit: 1000 });
		total += listed.objects.length;
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
	return total;
}

async function pickRandomKey(env: Env, prefix: string): Promise<string | null> {
	const count = await countPrefix(env, prefix);
	if (count === 0) return null;
	const target = Math.floor(Math.random() * count);
	let cursor: string | undefined;
	let seen = 0;
	// 分页定位第 target 个对象（图片量级不大时开销可接受，外层有缓存）
	do {
		const listed = await env.BUCKET.list({ prefix, cursor, limit: 1000 });
		if (target < seen + listed.objects.length) {
			return listed.objects[target - seen].key;
		}
		seen += listed.objects.length;
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
	return null;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const cors = corsHeaders(request, env);

		if (request.method === "OPTIONS") {
			cors.set("access-control-allow-methods", "GET, OPTIONS");
			return new Response(null, { status: 204, headers: cors });
		}
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: cors });
		}

		// 数量统计
		if (url.pathname === "/count.json") {
			const [h, v] = await Promise.all([
				countPrefix(env, `${IMAGE_PREFIX}h/`),
				countPrefix(env, `${IMAGE_PREFIX}v/`),
			]);
			cors.set("content-type", "application/json; charset=utf-8");
			cors.set("cache-control", "public, max-age=300");
			return new Response(JSON.stringify({ h, v }), { status: 200, headers: cors });
		}

		// 随机跳转
		if (url.pathname === "/random" || url.pathname === "/") {
			const type = url.searchParams.get("type") === "v" ? "v" : "h";
			const key = await pickRandomKey(env, `${IMAGE_PREFIX}${type}/`);
			if (!key) {
				return new Response("No images uploaded yet", { status: 404, headers: cors });
			}
			return new Response(null, {
				status: 302,
				headers: { location: `/${key}`, "cache-control": "no-store" },
			});
		}

		// 直接提供图片
		if (url.pathname.startsWith(`/${IMAGE_PREFIX}`)) {
			const key = decodeURIComponent(url.pathname.slice(1));
			const object = await env.BUCKET.get(key);
			if (!object) {
				return new Response("Not Found", { status: 404, headers: cors });
			}
			const headers = new Headers(cors);
			headers.set("content-type", object.httpMetadata?.contentType || "image/webp");
			headers.set("cache-control", "public, max-age=31536000, immutable");
			if (object.httpEtag) headers.set("etag", object.httpEtag);
			return new Response(request.method === "HEAD" ? null : object.body, {
				status: 200,
				headers,
			});
		}

		return new Response("Not Found", { status: 404, headers: cors });
	},
};
