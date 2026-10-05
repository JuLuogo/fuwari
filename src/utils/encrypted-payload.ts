import fs from "node:fs";
import path from "node:path";
import {
	type EncryptedPostPayload,
	PAYLOAD_VERSION,
	PBKDF2_ITERATIONS,
} from "./encrypted-format";

/** 加密载荷目录：由 scripts/lock-post.mjs 生成，跟着仓库一起提交 */
export const ENCRYPTED_DIR = "src/data/encrypted";

/** 读取某篇文章的加密载荷；文件缺失或格式不对时抛错（构建期直接失败，避免静默降级成明文页） */
export function getEncryptedPayload(slug: string): EncryptedPostPayload {
	const file = path.join(process.cwd(), ENCRYPTED_DIR, `${slug}.json`);
	if (!fs.existsSync(file)) {
		throw new Error(
			`[encrypted-post] 找不到加密载荷 ${ENCRYPTED_DIR}/${slug}.json；` +
				`请先在本地运行 \`pnpm lock-post ${slug}\` 生成密文（明文留在 private/posts/，不提交）。`,
		);
	}

	const payload = JSON.parse(
		fs.readFileSync(file, "utf8"),
	) as Partial<EncryptedPostPayload>;

	for (const key of ["salt", "iv", "ct"] as const) {
		if (typeof payload[key] !== "string" || payload[key] === "") {
			throw new Error(
				`[encrypted-post] ${ENCRYPTED_DIR}/${slug}.json 缺少字段 ${key}，文件可能损坏`,
			);
		}
	}

	return {
		v: payload.v ?? PAYLOAD_VERSION,
		alg: payload.alg ?? "AES-GCM",
		kdf: payload.kdf ?? "PBKDF2-SHA256",
		iter: payload.iter ?? PBKDF2_ITERATIONS,
		salt: payload.salt as string,
		iv: payload.iv as string,
		ct: payload.ct as string,
	};
}
