#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
	CONTENT_DIR,
	buildMarkdownGlob,
	listFiles,
} from "./utils/content-files.js";

const OLD_PATH_PATTERN = /\/public\/assets\/images\//g;
const NEW_PATH = "https://cdn.jsdelivr.net/gh/juluogo/fuwari@main/public/assets/images/";

async function getAllMarkdownFiles() {
	try {
		return await listFiles(buildMarkdownGlob(CONTENT_DIR, ["md"]));
	} catch (error) {
		console.error("获取 markdown 文件失败:", error.message);
		return [];
	}
}

function countOccurrences(content, pattern) {
	const matches = content.match(pattern);
	return matches ? matches.length : 0;
}

async function cdnifyImages() {
	console.log("🔍 开始替换图片路径为 CDN URL...");

	const markdownFiles = await getAllMarkdownFiles();
	console.log(`📄 找到 ${markdownFiles.length} 个 markdown 文件`);

	// 安全保护：扫描结果为空时中止，禁止继续删除 assets。
	if (markdownFiles.length === 0) {
		console.error(
			"❌ 未找到 markdown 文件，已中止执行。为避免误删，不会删除 public/assets。",
		);
		return;
	}

	let updatedCount = 0;
	let totalReplaced = 0;

	for (const file of markdownFiles) {
		try {
			const content = fs.readFileSync(file, "utf-8");
			// 重置正则表达式的 lastIndex
			OLD_PATH_PATTERN.lastIndex = 0;
			if (!OLD_PATH_PATTERN.test(content)) {
				continue;
			}

			// 重置正则表达式的 lastIndex
			OLD_PATH_PATTERN.lastIndex = 0;
			const occurrences = countOccurrences(content, OLD_PATH_PATTERN);
			// 重置正则表达式的 lastIndex
			OLD_PATH_PATTERN.lastIndex = 0;
			const newContent = content.replace(OLD_PATH_PATTERN, NEW_PATH);
			fs.writeFileSync(file, newContent);

			console.log(
				`✅ 已更新 ${path.relative(process.cwd(), file)}（替换 ${occurrences} 处）`,
			);
			updatedCount += 1;
			totalReplaced += occurrences;
		} catch (error) {
			console.warn(`⚠️  读取或写入失败: ${file} - ${error.message}`);
		}
	}

	console.log(
		`\n✨ 完成！更新了 ${updatedCount} 个文件，共替换 ${totalReplaced} 处路径。`,
	);

	// 安全保护：没有发生替换时，不执行删除。
	if (totalReplaced === 0) {
		console.warn("ℹ️  未发生任何路径替换，跳过删除 public/assets。");
		return;
	}

	const assetsDirToDelete = path.join(process.cwd(), "public/assets");
	if (!fs.existsSync(assetsDirToDelete)) {
		console.log("ℹ️  public/assets 不存在，无需删除。");
		return;
	}

	console.log(`🗑️  正在删除 ${assetsDirToDelete}...`);
	try {
		fs.rmSync(assetsDirToDelete, { recursive: true, force: true });
		console.log("✅ public/assets 文件夹已成功删除。");
	} catch (error) {
		console.warn(`⚠️  删除 public/assets 失败: ${error.message}`);
	}
}

cdnifyImages().catch((error) => {
	console.error("❌ 脚本执行失败:", error.message);
	process.exit(1);
});
