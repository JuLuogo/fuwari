# Cloudflare 服务清单与现状

站点域名：博客跑在 **`blog.juluo.work`**；根域 `juluo.work` 与 `www.juluo.work` 只做 301 跳转到博客。
全部服务都部署在 **Cloudflare Workers** 上（不用 Pages）。

> 部署命令与 GitHub 自动构建见 [workers-deploy.md](./workers-deploy.md)。

## 一、当前服务

| 子域 | 用途 | 实现 | 状态 |
| --- | --- | --- | --- |
| `blog.juluo.work` | 博客本体 | Worker `peroe-blog`（静态资源模式，`assets.directory = ./dist`） | ✅ |
| `juluo.work` / `www.juluo.work` | 301 → 博客 | Zone 动态跳转规则 | ✅ |
| `t.juluo.work` | 访问量统计 | Worker `cf-umami` + D1 `cf-umami`（fork: [juluowork/cf-umami](https://github.com/juluowork/cf-umami)，已修 `/share` 的 CORS） | ✅ |
| `icon.juluo.work` | 链接卡片元数据 `?url=` | Worker `link-card`，代码在 `services/link-card/` | ✅ |

**不使用**的服务（保持站点轻量）：

| 能力 | 方案 |
| --- | --- |
| 随机图 API | 直接使用现成的静态随机图服务 `https://pic.060730.xyz`（图片全在边缘节点，不占本站请求）：`/ri/h/{n}.webp` 横屏、`/ri/v/{n}.webp` 竖屏。数量写在 `src/config.ts` 的 `randomImageConfig.max / maxVertical`（实测 h=979、v=3596） |
| 文章配图 | **直接放进仓库**（`public/assets/images/` 或文章同目录），随构建一起由 Worker 分发，不需要图床 |
| 自建 Umami | 用 Umami Cloud（`src/config.ts` 的 `umamiConfig`） |
| NAT 类型检测 | **功能已移除**（原站后端是 Python + Docker + 双 STUN，需要 UDP 端口，Worker 承载不了） |
| OneDrive 文件索引 | 默认关闭（`oneDriveConfig.enable = false`，关闭时工具页不显示该标签） |

原站的 `eopfapi.acofork.com`（EdgeOne Pages Functions）与 `cnb.cool/2x.nz`（原作者 CNB 命名空间）都不再使用。

## 二、接口约定

### 浏览量：数据源有两个，Umami 优先、自建兜底

前台展示的数字**优先来自 Umami Cloud**（它从建站起就在记，数据是连续的），
自建 Worker + D1 只在 Umami 取不到时补位。开关都在 `src/config.ts`：
`umamiConfig.shareApiBase` + `viewCounterConfig.preferUmami`（优先），`viewCounterConfig.endpoint`（兜底）。

| 角色 | 位置 | 行为 |
| --- | --- | --- |
| 上报（写） | `src/components/layout/BodyThirdPartyScripts.astro` | 每个页面引入 `{endpoint}/tracker.js`，它按 `location.pathname` 向自建 `/send` 报一次 |
| 读（展示） | `src/scripts/view-counter-runtime.ts` | 先并发问 Umami（全站 1 次 + 每个路径 1 次），没覆盖到的路径再走自建 `POST /batch` 补齐；结果填 `#site-views`、文章卡片、`ViewsCounter` 的 span，并广播 `post-views-loaded` 给排序脚本 |

**Umami 分享接口**（只读、无需密钥；shareId 本来就是公开的，导航栏「统计」就指向分享页）：

```
GET  {gateway}/api/share/{shareId}
     -> {"shareId":...,"websiteId":"842d...","token":"<JWT，10 分钟有效>"}
GET  {gateway}/api/websites/{websiteId}/stats?startAt=0&endAt=<ms>              -> 全站全时段 pageviews
GET  {gateway}/api/websites/{websiteId}/stats?...&path=eq.%2Fposts%2Fxxx%2F     -> 该路径全时段 pageviews
     ⚠️ 必须带两个头：x-umami-share-token: <token> 与 x-umami-share-context: <shareId>
        （少了 context 头一律 401 —— umami 源码里叫「share token used outside share context」）
     ⚠️ gateway 按区不同：美国区是 https://gateway-us.umami.is
```

token 缓存在 `sessionStorage`（8 分钟）；401 时丢缓存重取一次，再失败就整体回落自建接口。
这套接口没有公开文档，参数是照着分享页抓包对出来的——**因此必须有兜底**，别把它当稳定契约。

**自建 `t.juluo.work`**（`viewCounterConfig.endpoint`，兜底）

```
GET  /share?pathname=/posts/xxx/   -> {"pathname":"/posts/xxx/","views":12}
POST /batch   ["/", "/posts/xxx/"] -> [0, 12]
GET  /tracker.js                   -> 自动上报的脚本（按 pathname 计数）
POST /send    {"pathname":"/"}     -> 记录一次访问（只接受来自 TRACKED_SITE_HOST 的请求）
```

⚠️ 只引读取端不引 `tracker.js`，D1 里就永远是空的（本项目曾长期处于这个状态，前台所有数字都是 0）。
D1 兜底里的 `/` 只是**首页 PV**，不是全站求和；换成 Umami 之后侧栏那个数才是真·全站全时段 PV（`/stats` 不带 path 过滤）。

**链接卡片 `icon.juluo.work`**（`linkCardApiConfig`）

```
GET /?url=https://astro.build
-> {"url":"...","title":"...","description":"...","image":"...","favicon":"..."}
```

只允许 http/https，屏蔽 localhost 与内网网段；CORS 只对 `ALLOWED_ORIGINS` 放开；结果缓存 10 分钟。

**随机图 `pic.060730.xyz`**（`randomImageConfig`）

```
GET /ri/h/{n}.webp   横屏（n = 1..979）
GET /ri/v/{n}.webp   竖屏（n = 1..3596）
```

文章封面若要随机图，在 frontmatter 里写 `image: random` 即可；画廊页 `/tools/gallery/` 也用它。
换服务只需改 `src/config.ts` 的三个值（`baseUrl` / `max` / `maxVertical`）。

## 三、`src/config.ts` 服务开关（当前值）

```ts
export const umamiConfig: UmamiConfig = {
	// ……websiteId / shareId / consentLevel 略……
	shareApiBase: "https://gateway-us.umami.is", // 浏览量优先从这里读（分享页自己也在打这个域）
};

export const viewCounterConfig: ViewCounterConfig = {
	enable: true,
	endpoint: "https://t.juluo.work", // 兜底：自建统计 Worker + D1
	preferUmami: true, // 优先读 Umami 分享接口
};

export const linkCardApiConfig: LinkCardApiConfig = {
	enable: true,
	baseUrl: "https://icon.juluo.work",
};

export const randomImageConfig: RandomImageConfig = {
	enable: true,
	baseUrl: "https://pic.060730.xyz",
	max: 979,
	maxVertical: 3596,
};

export const oneDriveConfig: OneDriveConfig = {
	enable: false, // 关闭时工具页不显示 OneDrive 标签
	apiBase: "https://e3.juluo.work/api/",
};
```

## 四、验证清单

- [x] `https://blog.juluo.work` 首页/`/privacy/`/`/friends/`/`/sponsors/`/`/tools/` 可访问
- [x] `https://juluo.work` 与 `https://www.juluo.work` 301 跳转到博客
- [x] `https://t.juluo.work/share?pathname=/` 返回 `{"pathname":"/","views":N}`
- [x] 每个页面都引了上报脚本并真的发出 `POST /send`（本机 Chrome 实测：首页 `/`、文章页 `/posts/<slug>/`、归档页 `/archive/` 各 1 条）
- [x] 浏览量优先取 Umami：本机构建实测侧栏显示 Umami 全时段 PV、文章卡片显示各文 PV；把网关掐断后自动回落到 `POST /batch`（用 111 的假数据肉眼确认过）
- [x] `https://icon.juluo.work/?url=https://astro.build` 返回 JSON
- [x] `https://pic.060730.xyz/ri/h/1.webp` 与 `/ri/v/1.webp` 返回图片
- [ ] 在 Cloudflare 控制台把 Worker `peroe-blog` 连到 `juluowork/fuwari`（构建由 Cloudflare 负责，见 workers-deploy.md）
