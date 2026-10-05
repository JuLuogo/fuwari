/**
 * 把构建产物发布到独立分支（供 Cloudflare Workers Builds 直接拉取部署）
 *
 * 产物分支内容（自包含，Cloudflare 侧无需任何构建命令）：
 *   dist/            构建好的静态站点
 *   wrangler.jsonc   Worker 配置（静态资源模式 + 自定义域）
 *   package.json     只声明 wrangler 依赖，供 npx wrangler deploy 使用
 *   README.md        说明该分支由 CI 生成
 *   .source-sha      对应的源码提交，便于排查
 *
 * 用法：
 *   node scripts/publish-artifact.mjs                 # 用当前 HEAD 构建产物发布
 *   node scripts/publish-artifact.mjs --dry-run       # 只准备目录，不推送
 *   node scripts/publish-artifact.mjs --sha <sha> --branch dist --remote <url>
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function arg(name, fallback = "") {
	const index = process.argv.indexOf(`--${name}`);
	if (index === -1) return fallback;
	const value = process.argv[index + 1];
	return value && !value.startsWith("--") ? value : "true";
}

const ROOT = process.cwd();
const dryRun = arg("dry-run", "") === "true";
const branch = arg("branch", process.env.ARTIFACT_BRANCH || "dist");
const remoteArg = arg("remote", process.env.ARTIFACT_REMOTE || "origin");
const sha = arg("sha", "") || execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();

// --remote 可以是 URL（CI 里带 token），也可以是仓库里已有的 remote 名（本地测试）
const remote =
	remoteArg.includes("://") || remoteArg.includes("@")
		? remoteArg
		: execFileSync("git", ["remote", "get-url", remoteArg], { cwd: ROOT }).toString().trim();

const distDir = path.join(ROOT, "dist");
if (!fs.existsSync(distDir)) {
	console.error("找不到 dist/，请先执行 pnpm astro build --force");
	process.exit(1);
}

const templateDir = path.join(ROOT, "scripts", "artifact");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "peroe-artifact-"));

function copyDir(from, to) {
	fs.mkdirSync(to, { recursive: true });
	for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
		const src = path.join(from, entry.name);
		const dest = path.join(to, entry.name);
		if (entry.isDirectory()) copyDir(src, dest);
		else fs.copyFileSync(src, dest);
	}
}

copyDir(distDir, path.join(work, "dist"));
for (const file of ["wrangler.jsonc", "package.json", "README.md"]) {
	fs.copyFileSync(path.join(templateDir, file), path.join(work, file));
}
fs.writeFileSync(path.join(work, ".source-sha"), `${sha}\n`, "utf-8");

const fileCount = (function count(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		total += entry.isDirectory() ? count(path.join(dir, entry.name)) : 1;
	}
	return total;
})(path.join(work, "dist"));

console.log(`产物目录: ${work}`);
console.log(`  文件数: ${fileCount}`);
console.log(`  源提交: ${sha}`);
console.log(`  目标分支: ${branch}`);
console.log(`  远端: ${remote.replace(/\/\/[^@]*@/, "//***@")}`);

if (dryRun) {
	console.log("--dry-run：跳过推送");
	process.exit(0);
}

function git(args, options = {}) {
	return execFileSync("git", args, { cwd: work, stdio: "pipe", ...options });
}

git(["init", "-q"]);
git(["checkout", "-q", "-b", branch]);
git(["add", "-A"]);
git([
	"-c",
	"user.name=github-actions[bot]",
	"-c",
	"user.email=41898282+github-actions[bot]@users.noreply.github.com",
	"commit",
	"-q",
	"-m",
	`build: 发布 ${sha.slice(0, 8)} 的构建产物`,
]);
git(["push", "-q", "--force", remote, `HEAD:refs/heads/${branch}`]);
console.log(`已推送到 ${branch} 分支`);
