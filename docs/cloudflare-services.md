# Cloudflare 服务清单与现状

站点域名：博客跑在 **`blog.juluo.work`**；根域 `juluo.work` 与 `www.juluo.work` 只做 301 跳转到博客。
全部服务都部署在 **Cloudflare Workers** 上（不用 Pages）。

> 部署命令与 GitHub 自动构建见 [workers-deploy.md](./workers-deploy.md)。

## 一、当前服务

| 子域 | 用途 | 实现 | 状态 |
| --- | --- | --- | --- |
| `blog.juluo.work` | 博客本体 | Worker `peroe-blog`（静态资源模式，`assets.directory = ./dist`） | ✅ |
| `juluo.work` / `www.juluo.work` | 301 → 博客 | Zone 动态跳转规则 | ✅ |
| `t.juluo.work` | 访问量统计 | Worker `cf-umami` + D1 `cf-umami`（fork: [JuLuogo/cf-umami](https://github.com/JuLuogo/cf-umami)，已修 `/share` 的 CORS） | ✅ |
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

**统计 `t.juluo.work`**（`viewCounterConfig`）

```
GET  /share?pathname=/posts/xxx/   -> {"pathname":"/posts/xxx/","views":12}
POST /batch   ["/", "/posts/xxx/"] -> [0, 12]
GET  /tracker.js                   -> 自动上报的脚本（按 pathname 计数）
POST /send    {"pathname":"/"}     -> 记录一次访问（只接受来自 TRACKED_SITE_HOST 的请求）
```

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
export const viewCounterConfig: ViewCounterConfig = {
	enable: true,
	endpoint: "https://t.juluo.work",
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
- [x] `https://icon.juluo.work/?url=https://astro.build` 返回 JSON
- [x] `https://pic.060730.xyz/ri/h/1.webp` 与 `/ri/v/1.webp` 返回图片
- [ ] 推送到 `main` 后 GitHub Actions 自动部署成功（见 workers-deploy.md）
