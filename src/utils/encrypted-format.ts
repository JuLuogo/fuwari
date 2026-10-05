/**
 * 加密载荷的格式定义（客户端与服务端共用的唯一事实来源）。
 *
 * ⚠️ 这个文件必须保持「浏览器安全」：不要在这里 import node:* ，
 * 因为 PasswordGate.svelte 也要引用它（类型 + 常量）。
 * 读取磁盘上的载荷请用 src/utils/encrypted-payload.ts。
 */

/** 载荷版本号；格式不兼容时递增 */
export const PAYLOAD_VERSION = 1;

/**
 * KDF 参数（取自 ShokaX 与 hexo-blog-encrypt v4 的交集，是被验证过的组合）
 * - PBKDF2-HMAC-SHA256，600000 次迭代
 * - 盐 16 字节随机，IV 12 字节随机，AES-256-GCM，tagLength 128
 */
export const PBKDF2_ITERATIONS = 600000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

/**
 * 加密载荷（v1）。
 * - ct 是 WebCrypto 的 `ciphertext ‖ tag`
 * - salt / iv / ct 均为 base64
 * - 明文是 JSON 字符串 `{ html, headings }`
 */
export interface EncryptedPostPayload {
	v: number;
	alg: string;
	kdf: string;
	iter: number;
	salt: string;
	iv: string;
	ct: string;
}

/** 解锁后从密文里解出来的内容 */
export interface UnlockedPostContent {
	html: string;
	headings: Array<{ depth: number; slug: string; text: string }>;
}

/**
 * 把载荷序列化成可以安全内联进 HTML 的 JSON：
 * 转义 `<` 防止出现 `</script>` 提前闭合标签。
 */
export function serializePayloadForHtml(payload: EncryptedPostPayload): string {
	return JSON.stringify(payload).split("<").join("\\u003c");
}
