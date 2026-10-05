---
title: 给静态博客的单篇文章上密码：构建期加密与浏览器解密
published: 2026-10-05 23:10:00 +08:00
description: "静态站没有服务端，密码保护只能靠真加密：构建期用 PBKDF2-HMAC-SHA256 派生密钥、AES-256-GCM 加密正文，产物里只剩盐、IV 和密文。这篇讲清参数取舍、公开仓库的明文隔离、元数据泄露清单与解密后要重跑的初始化。"
tags:
  - 建站
  - Astro
  - 安全
  - 工程实践
pinned: false
draft: false
---

静态博客的每位读者拿到的都是同一份 HTML，「给某篇文章上密码」的第一反应往往是前端藏一下。真要让不知道密码的人读不到正文，只剩一条路：**构建期就把正文加密成密文，密码只存在于作者的本地和读者的浏览器里**。本站刚把这条路走通，过程中发现真正麻烦的不是加密，而是正文之外那些顺手搬运内容的地方。

> [!NOTE]
> 前提：本站是 Astro 静态输出 + Svelte 组件岛，部署在 Cloudflare Workers 的静态资源模式下（`assets.directory = ./dist`，没有 Worker 脚本入口）。没有服务端逻辑、没有数据库、没有鉴权层——下面所有取舍都从这一点长出来。

![锁定态：页面里只有一个密码框和一行密码提示，正文、字数、阅读时长和侧栏目录都不在页面上](/assets/images/posts/blog-post-encryption/01-locked.webp)

## 没有服务端，「上密码」到底能不能做

能，但只能做一半，得先把期望摆正。

静态站构建完就是一堆文件，Workers 的静态资源模式只负责按 URL 发出去。读者 A 和读者 B 请求 `/posts/foo/`，拿到的是同一个字节流。既然服务端不做任何判断，**任何「服务器校验密码」的方案在这里都不成立**——没有地方运行那段校验代码。

剩下的只有两类：模板语法层面的掩护，和真加密。前者我全部排除了。

## 先排除三种障眼法

第一种是 CSS 隐藏：`display: none`、`visibility: hidden`、`filter: blur(8px)`。它们的共性是——**正文完整地躺在 HTML 里**：查看源代码、`curl` 一次、禁用 JavaScript，随便哪种都能读到。模糊是给眼睛看的，不是给解析器看的。

第二种是 JS 比对密码：密码写在脚本里，输入对了再 `document.body.innerHTML = 明文`。密码本身就在产物里，搜一下 `password` 就完了。

第三种本站现成就有：`.spoiler`，由 `||文字||` 语法（`src/plugins/remark-spoiler.js`）生成的 span：

```js
newChildren.push({
	type: "html",
	value: '<span class="spoiler" title="点击显示">',
});
```

样式是给文字加一层毛玻璃，点一下才去掉：

```css
.spoiler {
	filter: blur(0.4rem);
	transition: filter 0.3s;
	cursor: pointer;
	user-select: none;
}
```

它在防剧透这个场景里是对的：读者**本来就想看**，只是不想提前被剧透。当密码用就完全错了——文字从生成 HTML 那一刻起就是明文，`Ctrl+U` 就能读。

| 做法 | 正文在产物里的形态 | 谁能读到 | 适合挡什么 |
| --- | --- | --- | --- |
| CSS 隐藏 / blur | 明文 | 所有人（看源代码即可） | 剧透、不想一眼看到的段落 |
| JS 比对密码 | 明文 + 密码字符串 | 所有人（搜 `password` 即可） | 什么都不适合 |
| `.spoiler`（`\|\|文字\|\|`） | 明文 + 一行 blur 样式 | 所有人 | 剧透、折叠长段落 |
| 构建期真加密 | 密文（盐 + IV + 密文） | 只有知道密码的人 | 真正不想公开的内容 |

## 真加密的形态：三段数据流

思路的转变只有一句话：把「校验密码」换成「用密码解密」。密码不参与任何比较，它只是 PBKDF2 的输入；输错密码的唯一后果是 AES-GCM 认证失败、解出一堆乱码。所以产物里一个密码字符都没有。

本站的完整数据流是这样：

```text
【构建期 · 本地，只跑一次】pnpm lock-post <slug>
  private/posts/<slug>.md            明文正文 + frontmatter 里的 password
    │ ① 临时写回 src/content/posts/<slug>.md（先去掉 password），跑一次全量构建
    │ ② 从 dist/posts/<slug>/index.html 抠出 .custom-md 的 innerHTML 与标题大纲
    │ ③ PBKDF2-SHA256(600000 次) 派生密钥 → AES-256-GCM 加密 { html, headings }
    │ ④ 写 src/data/encrypted/<slug>.json，把 md 换成 stub，删掉本轮含明文的 dist 页面
    ▼
  提交物只有两个：
    src/content/posts/<slug>.md        stub：frontmatter + encrypted: true，正文为空
    src/data/encrypted/<slug>.json     v / alg / kdf / iter / salt / iv / ct

【部署 · 交给 Cloudflare 构建】astro build --force
  dist/posts/<slug>/index.html         密码框 + 内联 JSON 载荷，没有正文

【浏览器 · 每个读者各跑一次】
  输入密码 → WebCrypto 按同一组参数派生密钥 → AES-GCM 解密
    → JSON.parse 出 { html, headings } → innerHTML 注入 → 重跑各项初始化
```

载荷的字段定义在 `src/utils/encrypted-format.ts` 里，这个文件刻意保持「浏览器安全」（不 import `node:*`），因为它同时被构建脚本和 Svelte 组件引用：

```ts
export interface EncryptedPostPayload {
	v: number;
	alg: string;
	kdf: string;
	iter: number;
	salt: string;
	iv: string;
	ct: string;
}
```

线上那篇演示文章的载荷长这样（`ct` 是 15 KB 级别的密文，这里截断）：

```json
{
	"v": 1,
	"alg": "AES-GCM",
	"kdf": "PBKDF2-SHA256",
	"iter": 600000,
	"salt": "rjp/Yhf9CDBymyJmIBI8xw==",
	"iv": "w0oOgg1cN/5cHJDG",
	"ct": "o66vi+/pGH5NmLSJjzw7Cyhnc+XsAWuEXevAwcrVg9v1/0DwvtWvo+NbYT…"
}
```

盐、IV、迭代数都是公开的，这不是设计缺陷——密码学上它们本来就该公开，安全性由密码承担。真正要小心的是**别让载荷提前闭合 HTML 标签**：内联前过了一道转义，把 `<` 换成 `\u003c`（`src/utils/encrypted-format.ts`）：

```ts
export function serializePayloadForHtml(payload: EncryptedPostPayload): string {
	return JSON.stringify(payload).split("<").join("\\u003c");
}
```

另一个刻意的设计是**载荷缺失时构建直接失败，不降级**：`src/utils/encrypted-payload.ts` 找不到密文 JSON 就抛错，而不是安静地渲染成一篇空文章：

```ts
throw new Error(
	`[encrypted-post] 找不到加密载荷 ${ENCRYPTED_DIR}/${slug}.json；` +
		`请先在本地运行 \`pnpm lock-post ${slug}\` 生成密文（明文留在 private/posts/，不提交）。`,
);
```

对加密功能来说，「静默降级」比「构建失败」危险得多，所以这条错误信息故意写得很啰嗦。

## 参数与取舍

加密参数全部集中在 `src/utils/encrypted-format.ts` 顶部，注释里写明了来源（ShokaX 与 hexo-blog-encrypt v4 的交集）：

```ts
export const PBKDF2_ITERATIONS = 600000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
```

| 参数 | 取值 | 为什么是这个值 |
| --- | --- | --- |
| KDF | PBKDF2-HMAC-SHA256 | WebCrypto 原生支持，浏览器端不用引任何第三方密码库 |
| 迭代次数 | 600000 | 单次猜测的成本：每猜一个密码要算 60 万次 SHA-256 |
| 盐 | 16 字节随机 | 同一密码在不同文章里派生出不同密钥，彩虹表失效 |
| IV | 12 字节随机 | GCM 的标准长度；同一密钥下 IV 重用是致命的，所以每篇重新生成 |
| 加密 | AES-256-GCM，tagLength 128 | 自带认证标签：密码错和密文被改，都解不出来 |
| 版本与算法名 | `v` / `alg` / `kdf` / `iter` 全部写进载荷 | 将来换参数时，已经发出去的密文仍能按自己的参数解开 |

**为什么不用单次 MD5。** 不少前端加密示例（比如 crypto-js 的默认用法 `CryptoJS.AES.encrypt(text, password)`）走 OpenSSL 的 `EVP_BytesToKey`：只做一次 MD5 派生密钥。单次 MD5 与 60 万次 PBKDF2-SHA256 之间隔着 60 万倍的计算量，GPU 再快，这个倍数也要照付——改加密参数不是「更安全一点」，是换了一个数量级。

**为什么不用 bcrypt 先验密码。** bcrypt 回答的是「这个密码能不能通过校验」，而这里需要的是「用这个密码派生出一把能解密的密钥」——是 KDF，不是口令校验器。况且浏览器里没有原生 bcrypt，用一次就要引一个 wasm/JS 库，PBKDF2 则是 WebCrypto 自带的。`iter` 写进载荷也是同理：以后把 600000 调大，老密文不会被写坏。

浏览器端就是这两步：

```ts
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
```

## 安全边界，先把话说清楚

第一，**密文、盐、IV、迭代数全在 HTML 里**。攻击者不需要访问服务器，把页面存下来就能离线爆破，还能并行、不受限流影响。所以密码强度就是全部的安全性——600000 次迭代只能把弱密码从「一秒破」推迟到「几天破」，救不回来。

第二，**出错提示必须统一**。AES-GCM 下「密码错」和「密文被篡改」在客户端不可区分，硬要区分只会给攻击者送信息，所以本站只提示一种：

```ts
} catch {
	// 密码错误与密文被篡改在 AES-GCM 下无法区分，统一提示
	error = "密码错误";
	password = "";
}
```

![输入错误密码后，页面上只多出一行「密码错误」，没有更具体的错误信息](/assets/images/posts/blog-post-encryption/02-wrong-password.webp)

第三，**明文只在内存里**。组件不写 localStorage 也不写 sessionStorage，代价是每次刷新都要重新解密（手机上大概一两秒）。把明文写进 localStorage，等于给密码保护留了一把备用钥匙。

第四，**不算秘密的东西仍然公开**：标题、URL、发布时间、文章存在性，以及 frontmatter 里的 `passwordHint`（它渲染成密码框下面那行小字，所以别把密码写进提示里）。

## 解密之后会发生什么（最容易翻车的地方）

解锁成功只是把 HTML 塞进 DOM，页面并不会重新加载一遍。而本站那些看着很时髦的渲染——代码高亮、图片灯箱、Mermaid 流程图、表格横向滚动容器、侧栏目录——**都只在页面首次加载时跑一次**，初始化挂在 `DOMContentLoaded` 上，解密却发生在页面早就 load 完之后。更隐蔽的是 `innerHTML` 注入的 `<script>` 根本不会执行，链接卡片 `::url{}` 的元数据请求恰好写在脚本里。

所以 `PasswordGate.svelte` 里专门有一个「注入后重跑」的函数：

```ts
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
```

三个事件各有接收方，都是「本来就在监听，只是以前没人派发」：

```ts
window.addEventListener("fuwari:markdown-injected", () => {
	initMarkdown();
});
```

```ts
window.addEventListener("fuwari:images-injected", () => {
	initFancybox();
});
```

侧栏目录特殊一点：服务端渲染时它是空的，因为标题大纲会泄露正文结构——

```astro
const encrypted = isEncrypted(entry);
const payload = encrypted ? getEncryptedPayload(entry.id) : null;
const tocHeadings = encrypted ? [] : headings;
```

所以密文里连 `headings` 一起加密了，解锁后由 `fuwari:toc-rebuild` 事件重建列表，还得把那个自定义元素重新初始化一遍（`disconnectedCallback?.()` 之后再 `init?.()`），否则目录只是「看起来在那里」但点不动。

这是整篇里最值得强调的一条经验：**代码高亮和目录这类「增强」，写的时候都假设自己只跑一次**。我第一次解锁时正文出来了，代码块却是白板、表格顶到卡片边缘、目录空着——功能全对，样式全烂。

![解锁后：KaTeX 公式、表格、提示框、高亮代码块与链接卡片，全都是注入之后才渲染出来的](/assets/images/posts/blog-post-encryption/03-unlocked.webp)

## 公开仓库的坑：明文绝不能进 git

这是最容易做错、也最难补救的一环：本站文章页有一个「在 GitHub 上编辑此页」的直链，指向 `src/content/posts/<slug>.md`——**那个文件必须能公开见人**，而仓库本身也是 public 的。

所以本站把明文和提交物彻底分开：

| 文件 | 位置 | 是否提交 | 内容 |
| --- | --- | --- | --- |
| 明文 + 密码 | `private/posts/<slug>.md` | ❌（`.gitignore` 第 70 行忽略 `private/`） | 完整正文，frontmatter 里带 `password` |
| stub | `src/content/posts/<slug>.md` | ✅ | frontmatter + `encrypted: true`，正文为空 |
| 密文载荷 | `src/data/encrypted/<slug>.json` | ✅ | `v / alg / kdf / iter / salt / iv / ct` |

本地的明文长这样（`private/` 已在 `.gitignore` 里）：

```yaml
# private/posts/<slug>.md —— 只在本地
---
title: 一条需要密码的私人笔记
published: 2026-10-05 23:50:00 +08:00
password: <你的密码>        # lock-post 读它；stub 里会被删掉
passwordHint: "……"        # 可选，会渲染成密码框下面那行提示
---
正文照常写 Markdown
```

一条命令完成整个转换：

```bash
pnpm lock-post demo-private-note
```

它按顺序做四件事，每一件都对应一个具体的坑：

1. **读明文**。从 `private/posts/<slug>.md` 读正文和 frontmatter 里的 `password`，缺失或正文为空就直接失败。
2. **临时渲染 + 构建**。把还原出来的 frontmatter（**去掉 `password`**）和正文写回 `src/content/posts/<slug>.md`，跑一次 `pnpm update-diff` + `astro build --force`，再从 `dist/posts/<slug>/index.html` 的 `.custom-md` 容器里抠出正文 HTML 和标题大纲。
3. **加密 + 写载荷**。`crypto.getRandomValues` 生成 16 字节盐和 12 字节 IV，PBKDF2 派生密钥，AES-GCM 加密 `{ html, headings }`，写成 `src/data/encrypted/<slug>.json`。
4. **换成 stub**。把 `src/content/posts/<slug>.md` 覆盖成「frontmatter + 空正文」，顺手删掉本轮那个含明文的 `dist` 页面——因为「提取完忘了重建就部署」是最容易犯的错。

写完之后还有一道自检，把「密码泄漏进提交物」直接判死：

```js
const leaks = [];
if (/^\s*password\s*:/m.test(stubText)) leaks.push("stub 里还有 password 字段");
if (stubText.includes(password)) leaks.push("stub 里出现了密码明文");
if (payloadText.includes(password)) leaks.push("密文 JSON 里出现了密码明文");
if (leaks.length) {
	fail(`自检不通过：${leaks.join("；")}`);
}
```

**失败时怎么回滚。** 这条命令会临时往被 git 跟踪的目录里写明文，所以脚本的 `finally` 块是无条件的：只要这一轮没走完，就一定把 `src/content/posts/<slug>.md` 恢复成 stub（或运行前的样子），绝不会把明文留在那里等你手动收拾：

```js
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
```

跑完之后，仓库边界可以用命令验证，不用靠自觉：

![真实执行结果：private/ 被 .gitignore 忽略、只有 stub 与密文被跟踪、密码从未出现在任何一次提交里](/assets/images/posts/blog-post-encryption/04-git-boundary.webp)

最后一条不在脚本里、在人的习惯里：**提交信息也算公开信息**。本站加密文章的提交信息只写标题（本来就公开），但如果你顺手把正文摘要写进 commit message，它就永久留在 git 历史里了。

## 元数据泄露清单：只加密正文远远不够

正文是最显眼的泄露点，却不是唯一的：静态站会在构建期把内容「搬运」到很多地方，我挨个查了一遍：

| 泄露点 | 会泄露什么 | 本站怎么处理 |
| --- | --- | --- |
| 列表页摘要 | `excerpt` 就是正文第一段（`remark-excerpt` 生成） | `PostCard.astro` 里改成固定文案 `🔒 需要密码` |
| 字数 / 阅读时长 | 正文规模（几万字还是几百字，一眼看出） | 包在 `{!encrypted && (…)}` 里，不渲染 |
| 侧栏目录 TOC | 标题大纲＝文章结构 | 服务端传 `[]`，解锁后用密文里的 `headings` 重建 |
| RSS 全文 | `<description>` 里塞的是渲染后的正文 HTML | `rss.xml.ts` 里用 `publicPosts()` 过滤 |
| `/search.json` | 正文被压成纯文本的全文索引 | `search.json.ts` 同样用 `publicPosts()` 过滤 |
| `sitemap.xml` | 给搜索引擎的入口 | 集合过滤条件里加 `data.encrypted !== true` |
| 侧栏「总字数」 | 把加密文章算进去就等于公开它的长度 | `Profile.astro` 累加时用 `publicPosts()` |
| 上下篇标题 | `prevTitle` / `nextTitle` | **故意保留**，见下 |
| 修订历史 / 编辑入口 | commit message、diff、可点的源码直链 | 加密文章整块隐藏（`gitHubEditConfig.enable && !encrypted`） |

过滤入口只有一个文件，`src/utils/post-visibility.ts`，其余地方一律调它：

```ts
/** 过滤掉加密文章（正文不可公开，不能进 RSS / 搜索索引 / 站点地图 / 字数统计） */
export function publicPosts(
	posts: CollectionEntry<"posts">[],
): CollectionEntry<"posts">[] {
	return posts.filter((post) => !isEncrypted(post));
}
```

列表页那一处是唯一需要「换个说法」而不是删掉的，因为卡片上总得显示点什么：

```astro
{ encrypted ? "🔒 需要密码" : (description || remarkPluginFrontmatter.excerpt) }
```

字数与阅读时长则直接隐藏：

```astro
{!encrypted && (
<div class="text-sm text-white/30 flex gap-4 transition">
    <div>{remarkPluginFrontmatter.words} 字</div>
    <div>|</div>
    <div>{remarkPluginFrontmatter.minutes} 分钟</div>
</div>
)}
```

站点地图是另一套过滤（它直接 `getCollection`，没走 `getSortedPosts`）：

```ts
// 加密文章不进站点地图（正文不对搜索引擎开放）
const posts = await getCollection("posts", ({ data }) => {
	return !data.draft && data.encrypted !== true;
});
```

**故意保留的部分也要说清楚。** 标题、URL、发布时间、文章存在性、上下篇标题，本站一概不隐藏。理由是读者需要在列表页看到「这里有一篇要密码的文章」，也需要能把链接发给别人；连存在性都藏起来的话，这套东西就变成「隐藏文章」了，那是另一个功能。取舍就一句话：**加密保护的是正文，不是这篇文章的存在**。

顺带一提，`/posts.json` 也没问题：它只有 `/posts/<slug>` 路径数组，没有正文或摘要。

## 去试一下演示文章

本站已经发布了一篇演示：[《一条需要密码的私人笔记》](/posts/demo-private-note/)，**密码是 `peroe-demo-2026`**，上面三张截图就是它的三个状态。建议按这个顺序试：

1. 打开 `/posts/demo-private-note/`，看到的是密码框（图 1）。顺手 `Ctrl+U` 打开源代码，搜正文里的任何一句话——搜不到，页面里只有那段内联的 JSON 载荷。
2. 随便输一个密码，等半秒左右，页面只多一行「密码错误」（图 2）。那半秒就是 60 万次 PBKDF2 在算。
3. 输入 `peroe-demo-2026`，正文出现，公式、表格、提示框、代码块、链接卡片一起就位（图 3）。

## 什么内容适合加密，什么不适合

适合的是「不希望陌生人顺手读到，但也不是机密」的内容：只给一两个人看的私人笔记、账单与额度边界、还没定要不要公开的草稿、给朋友对答案的题解。

不适合的同样明确：

- **真正的秘密**（API Key、口令、身份证号）不要放：别人可以离线爆破，读者也可能转发。
- **需要按人授权的**内容不要放。这套方案只有一个密码，谁拿到都能看，没有账号体系。
- **需要撤回的**内容要谨慎。密文一旦推出去就进了别人的缓存和 CDN；改密码重新加密只对新访客生效，**已经存下旧 HTML 的人仍然能用旧密码解开**。
- **纯防剧透**内容没必要：`.spoiler` 那类轻量掩护就够了，真加密每次刷新都要解密，还要处理上面那一堆初始化。

这套方案的局限就三句：不含服务端鉴权（密码即全部）；不能防「读者自己转发解锁后的内容」；正文之外仍有一圈公开的元数据（标题、URL、存在性、发布时间）。接受这三条，它就能用。

## 小结

静态博客做密码保护，本质上是把「服务器校验」换成「密码学」：构建期加密、浏览器解密、产物里只有盐和密文。加密本身是半个下午的事，真正吃时间的是两件外围工作——**把明文和密码挡在 git 之外**，以及**把构建期顺手搬运正文的角落一个个堵上**；前者靠 `private/` + stub + 自检 + `finally` 兜底，后者靠一个统一的 `publicPosts()` 过滤器。

如果你的博客也是纯静态、也有几篇不想公开的内容，这套方案可以直接照搬；但如果需要的是「按人授权、可撤回」，那就不是加密能解决的，得去要一个真正的服务端。
