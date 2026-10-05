# Cloudflare 服务清单与现状

站点域名：博客跑在二级域名 **`blog.juluo.work`**；根域 `juluo.work` 与 `www.juluo.work` 只做 301 跳转到博客。
以下服务全部来自原站（afoim）的自建依赖，现已在你自己的 Cloudflare 账号上**用 Workers 重建**。

> 部署命令与 GitHub 自动构建步骤见 [workers-deploy.md](./workers-deploy.md)。

## 一、已上线的服务

| 子域 | 用途 | 实现 | 状态 |
| --- | --- | --- | --- |
| `blog.juluo.work` | 博客本体 | Worker `peroe-blog`（静态资源模式） | ✅ |
| `juluo.work` / `www.juluo.work` | 301 → 博客 | Zone 动态跳转规则 | ✅ |
| `t.juluo.work` | 访问量统计 | Worker `cf-umami` + D1 `cf-umami`（fork: [JuLuogo/cf-umami](https://github.com/JuLuogo/cf-umami)，已修 `/share` 的 CORS） | ✅ |
| `icon.juluo.work` | 链接卡片元数据 `?url=` | Worker `link-card`，代码在 `services/link-card/` | ✅ |
| `p.juluo.work` | 随机图 `/count.json`、`/random`、`/ri/h/*` | Worker `random-pic` + R2 桶 `juluo`，代码在 `services/random-pic/` | ✅ |
| `nat.juluo.work` | NAT 类型检测后端 | 原站为 Python + Docker + 双 STUN，**需要 UDP 端口，Worker 无法承载** | ❌ 未部署（站点已改为配置开关，工具列表自动隐藏） |
| `img.juluo.work` | 图床自定义域（可选） | R2 桶 `juluo` 的 custom domain | ⏳ 需要在面板添加（API 报 `10040`） |
| `e3.juluo.work` | 文件索引（可选） | [JuLuogo/CloudFlare-ImgBed](https://github.com/JuLuogo/CloudFlare-ImgBed) | ⏳ 可选未部署 |

原站的 `eopfapi.acofork.com`（EdgeOne Pages Functions 随机图）与 `cnb.cool/2x.nz`（原作者 CNB 命名空间）
都不再使用：随机图改由 `p.juluo.work` 承担，图片 CDN 已在 `scripts/cdnify-images.js` 中改为 jsDelivr。

## 二、接口约定

**统计 `t.juluo.work`**（`src/config.ts` 的 `viewCounterConfig`）

```
GET  /share?pathname=/posts/xxx/   -> {"pathname":"/posts/xxx/","views":12}
POST /batch   ["/", "/posts/xxx/"] -> [0, 12]
GET  /tracker.js                   -> 自动上报的脚本（按 pathname 计数）
POST /send    {"pathname":"/"}     -> 记录一次访问（只接受来自 TRACKED_SITE_HOST 的请求）
```

**链接卡片 `icon.juluo.work`**（`linkCardApiConfig`）

```
GET /?url=https://astro.build
-> {"url":"https://astro.build/","title":"Astro","description":"...","image":"...","favicon":"..."}
```

只允许 http/https，屏蔽 localhost 与内网网段；CORS 只对 `ALLOWED_ORIGINS` 放开；结果缓存 10 分钟。

**随机图 `p.juluo.work`**（`randomImageConfig`）

```
GET /count.json          -> {"h":横屏数量,"v":竖屏数量}
GET /random?type=h|v     -> 302 到随机一张图
GET /ri/h/{n}.webp       -> 图片（直接读 R2，一年强缓存）
```

图片放在 R2 桶 `juluo` 的 `ri/h/`（横屏）、`ri/v/`（竖屏），命名 `1.webp`、`2.webp`…
站点的 `max` 设为 `0` 时会自动读取 `/count.json`，新增图片后无需改代码。

## 三、R2 使用说明

- 桶：`juluo`（APAC），由 Worker `random-pic` 通过 R2 绑定访问
- S3 端点：`https://<账号ID>.r2.cloudflarestorage.com`
- S3 凭据可由 API 令牌推导：**Access Key ID = 令牌 ID（必须小写）**，
  **Secret Access Key = `SHA256(令牌值)`**
- 上传示例（rclone）：

  ```powershell
  rclone config create r2 s3 provider Cloudflare `
    access_key_id <令牌ID> secret_access_key <SHA256(令牌值)> `
    endpoint https://<账号ID>.r2.cloudflarestorage.com
  rclone copy .\ri r2:juluo/ri --progress
  ```

## 四、`src/config.ts` 里的服务开关（当前值）

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
	baseUrl: "https://p.juluo.work",
	max: 0, // 0 = 自动读 /count.json
};

export const natCheckConfig: NatCheckConfig = {
	enable: false, // 需要自备带 UDP 的 VPS 才能启用
	apiUrl: "",
};

export const oneDriveConfig: OneDriveConfig = {
	enable: false, // 关闭时工具页不显示 OneDrive 标签
	apiBase: "https://e3.juluo.work/api/",
};

export const imageFallbackConfig: ImageFallbackConfig = {
	enable: false,
	originalDomain: "https://p.juluo.work",
	fallbackDomain: "https://p.juluo.work",
};
```

## 五、验证清单

- [x] `https://blog.juluo.work` 首页/`/privacy/`/`/friends/`/`/sponsors/`/`/tools/` 可访问
- [x] `https://juluo.work` 与 `https://www.juluo.work` 301 跳转到博客
- [x] `https://t.juluo.work/share?pathname=/` 返回 `{"pathname":"/","views":N}`
- [x] `https://icon.juluo.work/?url=https://astro.build` 返回 JSON
- [x] `https://p.juluo.work/count.json` 返回 `{"h":N,"v":M}`
- [ ] 在 Workers 控制台把 `peroe-blog` 连到 GitHub 仓库（见 workers-deploy.md）
- [ ] 给 `juluogo/giscus` 安装 [giscus App](https://github.com/apps/giscus)
- [ ] 往 R2 桶传随机图素材
