<!--
  加密文章（单篇密码保护）的解锁组件。
  用 Svelte 4 语法写（export let / on:click / bind:），因为 astro.config.mjs 里设了
  compatibility.componentApi = 4。

  流程：读取页面内联的 <script type="application/json" id="post-payload"> →
  WebCrypto PBKDF2-SHA256(600000) 派生 AES-256-GCM 密钥 → 解密 →
  JSON.parse 出 { html, headings } → 注入 DOM → 手动重跑各项初始化。

  安全约定：
  - 明文只存在于内存，绝不写 localStorage / sessionStorage
  - 解密失败（GCM 认证失败）统一提示「密码错误」，不区分密码错与密文被篡改
-->
<script lang="ts">
	import { onMount, tick } from "svelte";
	import { initCodeHighlight } from "@utils/code-highlight";
	import {
		type EncryptedPostPayload,
		type UnlockedPostContent,
	} from "@utils/encrypted-format";

	export let hint = "";

	let password = "";
	let busy = false;
	let error = "";
	let unlocked = false;

	let bodyEl: HTMLDivElement | null = null;
	let inputEl: HTMLInputElement | null = null;

	onMount(() => {
		inputEl?.focus();
	});

	function readPayload(): EncryptedPostPayload | null {
		const el = document.getElementById("post-payload");
		if (!el?.textContent) return null;
		try {
			return JSON.parse(el.textContent) as EncryptedPostPayload;
		} catch {
			return null;
		}
	}

	function base64ToBytes(base64: string): Uint8Array {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}

	async function deriveAesKey(
		passphrase: string,
		salt: Uint8Array,
		iterations: number,
	): Promise<CryptoKey> {
		const baseKey = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(passphrase),
			"PBKDF2",
			false,
			["deriveKey"],
		);
		return crypto.subtle.deriveKey(
			{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
			baseKey,
			{ name: "AES-GCM", length: 256 },
			false,
			["decrypt"],
		);
	}

	/** 注入正文后，把「只在首次加载时跑一次」的初始化重跑一遍 */
	function reinitialize(headings: UnlockedPostContent["headings"]) {
		// innerHTML 注入的 <script> 不会执行（::url{} 链接卡片的元数据请求就在里面），手动补跑
		bodyEl?.querySelectorAll("script").forEach((old) => {
			const script = document.createElement("script");
			for (const attr of Array.from(old.attributes)) {
				script.setAttribute(attr.name, attr.value);
			}
			script.text = old.text;
			old.replaceWith(script);
		});

		// 表格包裹 + Mermaid 渲染（逻辑在 components/misc/Markdown.astro）
		window.dispatchEvent(new CustomEvent("fuwari:markdown-injected"));
		// 代码高亮（Prism + 复制按钮）
		initCodeHighlight();
		// 图片灯箱（逻辑在 scripts/layout-fancybox-runtime.ts，避免把 Fancybox 打进文章页的 island 包）
		window.dispatchEvent(new CustomEvent("fuwari:images-injected"));
		// 侧栏目录（服务端渲染时 headings 被刻意传成 []）
		window.dispatchEvent(
			new CustomEvent("fuwari:toc-rebuild", { detail: { headings } }),
		);
	}

	async function unlock() {
		if (busy) return;

		if (!password) {
			error = "请输入密码";
			return;
		}

		if (!window.crypto?.subtle) {
			error = "当前环境不支持 WebCrypto（需要用 HTTPS 或 localhost 打开）";
			return;
		}

		const payload = readPayload();
		if (!payload) {
			error = "页面里没有找到加密载荷，无法解锁";
			return;
		}

		busy = true;
		error = "";

		try {
			const key = await deriveAesKey(
				password,
				base64ToBytes(payload.salt),
				payload.iter,
			);
			const plaintext = await crypto.subtle.decrypt(
				{
					name: "AES-GCM",
					iv: base64ToBytes(payload.iv),
					tagLength: 128,
				},
				key,
				base64ToBytes(payload.ct),
			);

			const content = JSON.parse(
				new TextDecoder().decode(plaintext),
			) as UnlockedPostContent;

			unlocked = true;
			await tick();
			if (bodyEl) {
				bodyEl.innerHTML = content.html || "";
			}
			reinitialize(content.headings || []);
		} catch {
			// 密码错误与密文被篡改在 AES-GCM 下无法区分，统一提示
			error = "密码错误";
			password = "";
		} finally {
			busy = false;
		}
	}
</script>

{#if !unlocked}
	<div class="flex flex-col items-center justify-center py-10">
		<div class="w-full max-w-md">
			<div class="text-center mb-5">
				<div class="text-4xl mb-2 select-none">🔒</div>
				<div class="text-white/85 font-bold text-lg">这是一篇加密文章</div>
				<div class="text-white/45 text-sm mt-1">
					输入密码解锁正文。解密只在你的浏览器里完成，服务器上没有明文。
				</div>
			</div>

			<form class="flex flex-col gap-2" on:submit|preventDefault={unlock}>
				<div class="flex gap-2">
					<input
						bind:this={inputEl}
						bind:value={password}
						type="password"
						name="post-password"
						autocomplete="current-password"
						aria-label="文章密码"
						placeholder="请输入密码"
						disabled={busy}
						class="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 placeholder:text-white/25 outline-none transition focus:border-[var(--primary)] disabled:opacity-60"
					/>
					<button
						type="submit"
						disabled={busy}
						class="btn-regular px-4 py-2 rounded-lg font-bold whitespace-nowrap active:scale-95 disabled:opacity-60 disabled:active:scale-100"
					>
						{busy ? "解密中…" : "解锁"}
					</button>
				</div>

				<p
					class="min-h-5 text-sm text-red-300/90"
					role="alert"
					aria-live="polite"
				>{error}</p>
			</form>

			{#if hint}
				<div class="text-center text-xs text-white/35 mt-1">
					密码提示：{hint}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- 解锁后的正文容器；样式由外层 <Markdown> 的 .custom-md 提供 -->
<div bind:this={bodyEl} class:hidden={!unlocked}></div>
