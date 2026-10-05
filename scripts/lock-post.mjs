#!/usr/bin/env node
/**
 * 把一篇「明文文章」锁定成加密文章。
 *
 *   node scripts/lock-post.mjs <slug> [--password <pw>] [--skip-build]
 *
 * 做四件事：
 *   1. 从 private/posts/<slug>.md 读明文（frontmatter 里带 password）
 *   2. 把正文临时渲染进 src/content/posts/<slug>.md，跑一次构建，从
 *      dist/posts/<slug>/index.html 里抠出「正文 HTML + 目录 headings」
 *   3. 用 PBKDF2-SHA256(600000) + AES-256-GCM 加密成载荷，写 src/data/encrypted/<slug>.json
 *   4. 把 src/content/posts/<slug>.md 换成 stub（frontmatter 保留、正文清空、去掉 password）
 *
 * 提交物只有两样：stub 与密文 JSON。明文和密码永远留在 gitignored 的 private/ 里。
 */

import { spawn } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse as parseHtml } from "node-html-parser";

const ROOT = process.cwd();
const PRIVATE_DIR = path.join(ROOT, "private", "posts");
const CONTENT_DIR = path.join(ROOT, "src", "content", "posts");
const ENCRYPTED_DIR = path.join(ROOT, "src", "data", "encrypted");

/** KDF / 加密参数：与 src/utils/encrypted-format.ts 保持一致 */
const PAYLOAD_VERSION = 1;
const ITERATIONS = 600000;

/* ------------------------------------------------------------------ *
 * 参数
 * ------------------------------------------------------------------ */

let passwordFromCli;
let skipBuild = false;
const positionals = [];

for (let i = 2; i < process.argv.length; i++) {
	const arg = process.argv[i];
	if (arg === "--password") {
		passwordFromCli = process.argv[++i];
	} else if (arg === "--skip-build") {
		skipBuild = true;
	} else if (arg === "--help" || arg === "-h") {
		positionals.push("--help");
	} else if (!arg.startsWith("--")) {
		positionals.push(arg);
	}
}

const slug = positionals[0];

function fail(message) {
	throw new Error(message);
}

function usage() {
	console.log(`用法: node scripts/lock-post.mjs <slug> [--password <pw>] [--skip-build]

  <slug>              文章 slug（对应 private/posts/<slug>.md 与 src/content/posts/<slug>.md）
  --password <pw>     临时覆盖 frontmatter 里的 password（不会写进任何文件）
  --skip-build        复用已有的 dist/posts/<slug>/index.html，不重新构建（调试用）`);
}

/* ------------------------------------------------------------------ *
 * frontmatter 处理（逐行处理，保留原始文本，避免 YAML 重新序列化）
 * ------------------------------------------------------------------ */

function splitFrontmatter(raw) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
	if (!match) {
		fail("文件开头没有找到 frontmatter（第一行必须是 ---）");
	}
	return { frontmatter: match[1], body: raw.slice(match[0].length) };
}

/** 找出 frontmatter 里每个顶层 key 覆盖的行区间 */
function frontmatterBlocks(frontmatter) {
	const lines = frontmatter.split(/\r?\n/);
	const blocks = [];
	let current = null;

	lines.forEach((line, index) => {
		const match = /^([A-Za-z_][\w-]*)\s*:/.exec(line);
		if (match) {
			current = { key: match[1], start: index, end: lines.length };
			blocks.push(current);
		}
	});

	return { lines, blocks };
}

function getFrontmatterValue(frontmatter, key) {
	const { lines, blocks } = frontmatterBlocks(frontmatter);
	const block = blocks.find((b) => b.key === key);
	if (!block) return undefined;

	const firstLine = lines[block.start];
	const inline = firstLine.slice(firstLine.indexOf(":") + 1).trim();
	const value =
		inline !== "" ? inline : lines.slice(block.start + 1, block.end).join("\n").trim();

	return value.replace(/^["']|["']$/g, "");
}

function stripFrontmatterKeys(frontmatter, keys) {
	const { lines, blocks } = frontmatterBlocks(frontmatter);
	const remove = new Set();
	for (const block of blocks) {
		if (keys.includes(block.key)) {
			for (let i = block.start; i < block.end; i++) remove.add(i);
		}
	}
	return lines.filter((_, index) => !remove.has(index)).join("\n");
}

/* ------------------------------------------------------------------ *
 * 从 dist 产物里抠正文
 * ------------------------------------------------------------------ */

function collectHeadings(element, out = []) {
	for (const child of element.childNodes) {
		if (child.nodeType !== 1) continue;
		const tag = String(child.rawTagName || "").toLowerCase();
		if (/^h[1-6]$/.test(tag)) {
			const id = child.getAttribute("id");
			if (id) {
				out.push({ depth: Number(tag[1]), slug: id, text: headingText(child) });
			}
		}
		collectHeadings(child, out);
	}
	return out;
}

/** 标题文本要去掉 rehype-autolink-headings 追加的 “#” 锚点 */
function headingText(element) {
	let text = "";
	for (const child of element.childNodes) {
		if (child.nodeType === 1) {
			if (child.classList?.contains("anchor")) continue;
			text += child.text ?? "";
		} else if (child.nodeType === 3) {
			text += child.text ?? child.rawText ?? "";
		}
	}
	return text.replace(/\s+/g, " ").trim();
}

function run(command, commandArgs) {
	return new Promise((resolve) => {
		const child = spawn(command, commandArgs, {
			cwd: ROOT,
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		child.on("close", (code) => resolve(code ?? 1));
	});
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

async function main() {
	if (!slug || slug === "--help") {
		usage();
		process.exitCode = slug ? 0 : 1;
		return;
	}

	/* 第一步：读明文 */
	const plaintextFile = path.join(PRIVATE_DIR, `${slug}.md`);
	if (!fs.existsSync(plaintextFile)) {
		fail(`找不到明文 ${path.relative(ROOT, plaintextFile)}。

加密文章的明文只放本地，格式：
  private/posts/${slug}.md   ← frontmatter 里除了 title/published/tags… 还要有 password
如果明文现在还在 src/content/posts/ 里，先把它移动到 private/posts/。`);
	}

	const plaintextRaw = fs.readFileSync(plaintextFile, "utf8");
	const plaintext = splitFrontmatter(plaintextRaw);
	const password =
		passwordFromCli || getFrontmatterValue(plaintext.frontmatter, "password");

	if (!password) {
		fail(
			`在 ${path.relative(ROOT, plaintextFile)} 的 frontmatter 里没有找到 password（也可以用 --password 传入）`,
		);
	}
	if (plaintext.body.trim() === "") {
		fail(`${path.relative(ROOT, plaintextFile)} 的正文是空的，没什么可加密的`);
	}

	/** 构建用的临时 frontmatter：去掉 password / encrypted，让这一轮能正常渲染出正文 */
	const buildFrontmatter = stripFrontmatterKeys(plaintext.frontmatter, [
		"password",
		"encrypted",
	]);
	/** 提交用的 stub frontmatter：同样去掉 password / encrypted，再显式标记 encrypted: true */
	const stubFrontmatter = `${stripFrontmatterKeys(plaintext.frontmatter, [
		"password",
		"encrypted",
	])}\nencrypted: true`;

	const tempFile = path.join(CONTENT_DIR, `${slug}.md`);
	const payloadFile = path.join(ENCRYPTED_DIR, `${slug}.json`);
	const distPage = path.join(ROOT, "dist", "posts", slug, "index.html");

	const originalStub = fs.existsSync(tempFile)
		? fs.readFileSync(tempFile, "utf8")
		: `---\n${stubFrontmatter}\n---\n`;

	console.log(`\n🔒 锁定文章：${slug}`);
	console.log(
		`   明文：${path.relative(ROOT, plaintextFile)}（${plaintextRaw.length} 字节，不会提交）`,
	);
	console.log(
		`   密码：${"*".repeat(password.length)}（来自 ${passwordFromCli ? "--password" : "frontmatter"}，不会写进任何文件）`,
	);

	let wroteTemp = false;
	let completed = false;

	try {
		/* 第二步：临时渲染 + 构建 */
		fs.mkdirSync(CONTENT_DIR, { recursive: true });
		fs.writeFileSync(
			tempFile,
			`---\n${buildFrontmatter}\n---\n${plaintext.body}`,
			"utf8",
		);
		wroteTemp = true;
		console.log(`\n→ 临时写入 ${path.relative(ROOT, tempFile)}（不含 password），准备渲染…`);

		if (skipBuild) {
			console.log("→ 跳过构建（--skip-build）");
		} else {
			console.log("→ pnpm update-diff");
			await run("pnpm", ["update-diff"]);
			console.log("→ pnpm astro build --force");
			const startedAt = Date.now();
			const code = await run("pnpm", ["astro", "build", "--force"]);
			const built =
				fs.existsSync(distPage) && fs.statSync(distPage).mtimeMs >= startedAt - 2000;
			if (code !== 0 && !built) {
				fail(`构建失败（exit code ${code}）`);
			}
			if (code !== 0 && built) {
				console.warn(
					`⚠️ 构建进程退出码 ${code}（Windows 上 libuv 退出时的偶发崩溃），但产物已生成，继续。`,
				);
			}
		}

		if (!fs.existsSync(distPage)) {
			fail(`没有找到 ${path.relative(ROOT, distPage)}，构建可能失败了`);
		}

		const root = parseHtml(fs.readFileSync(distPage, "utf8"));
		const container = root.querySelector(".custom-md");
		if (!container) {
			fail(`在 ${path.relative(ROOT, distPage)} 里没有找到正文容器 .custom-md`);
		}

		const html = container.innerHTML;
		const headings = collectHeadings(container);
		if (html.trim() === "") {
			fail("从产物里抠出来的正文是空的，构建结果不对");
		}
		console.log(`   抠出正文 ${html.length} 字符、目录 ${headings.length} 项`);

		if (html.includes(password)) {
			fail("正文里出现了密码明文，先把它从正文里删掉再锁定");
		}

		/* 第三步：加密 + 写载荷 */
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encoder = new TextEncoder();
		const toBase64 = (bytes) => Buffer.from(bytes).toString("base64");

		const baseKey = await crypto.subtle.importKey(
			"raw",
			encoder.encode(password),
			"PBKDF2",
			false,
			["deriveKey"],
		);
		const aesKey = await crypto.subtle.deriveKey(
			{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
			baseKey,
			{ name: "AES-GCM", length: 256 },
			false,
			["encrypt"],
		);
		const ciphertext = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv, tagLength: 128 },
			aesKey,
			encoder.encode(JSON.stringify({ html, headings })),
		);

		const payload = {
			v: PAYLOAD_VERSION,
			alg: "AES-GCM",
			kdf: "PBKDF2-SHA256",
			iter: ITERATIONS,
			salt: toBase64(salt),
			iv: toBase64(iv),
			ct: toBase64(new Uint8Array(ciphertext)),
		};

		fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
		fs.writeFileSync(payloadFile, `${JSON.stringify(payload, null, "\t")}\n`, "utf8");
		console.log(
			`\n→ 密文写入 ${path.relative(ROOT, payloadFile)}（${fs.statSync(payloadFile).size} 字节）`,
		);

		/* 第四步：换成 stub */
		fs.writeFileSync(tempFile, `---\n${stubFrontmatter}\n---\n`, "utf8");
		console.log(`→ stub 写入 ${path.relative(ROOT, tempFile)}（frontmatter + 空正文）`);

		// 本轮提取用的 dist 页面里还留着明文，直接删掉，避免忘了重建就部署
		if (fs.existsSync(distPage)) {
			fs.rmSync(path.dirname(distPage), { recursive: true, force: true });
			console.log(
				`→ 已删除 ${path.relative(ROOT, distPage)}（本轮提取用的明文页面；部署前请照常再构建一次）`,
			);
		}

		/* 自检 */
		const stubText = fs.readFileSync(tempFile, "utf8");
		const payloadText = fs.readFileSync(payloadFile, "utf8");
		const leaks = [];
		if (/^\s*password\s*:/m.test(stubText)) leaks.push("stub 里还有 password 字段");
		if (stubText.includes(password)) leaks.push("stub 里出现了密码明文");
		if (payloadText.includes(password)) leaks.push("密文 JSON 里出现了密码明文");
		if (leaks.length) {
			fail(`自检不通过：${leaks.join("；")}`);
		}

		completed = true;
		console.log(`
✔ 完成。提交下面两样，明文不要提交：
   git add ${path.relative(ROOT, tempFile)} ${path.relative(ROOT, payloadFile)}

   明文仍在 ${path.relative(ROOT, plaintextFile)}（private/ 已在 .gitignore 里）
   部署前记得再跑一次 pnpm astro build --force，让 dist 里的页面也变成密文版
`);
	} finally {
		// 无论成功失败，都不要把明文留在被 git 跟踪的 src/content/posts 里
		if (!completed && wroteTemp) {
			if (originalStub.includes(password) || /^\s*password\s*:/m.test(originalStub)) {
				fs.writeFileSync(tempFile, `---\n${stubFrontmatter}\n---\n`, "utf8");
			} else {
				fs.writeFileSync(tempFile, originalStub, "utf8");
			}
			console.error(
				`⚠️ 已把 ${path.relative(ROOT, tempFile)} 恢复为 stub（本轮未完成加密）`,
			);
		}
	}
}

main().catch((error) => {
	console.error(`\n✖ ${error instanceof Error ? error.message : error}\n`);
	process.exitCode = 1;
});
