# Cloudflare 自建服务部署方案

站点主域：`juluo.work`（apex 直接作为博客域名，`www` 建议 301 到 apex）。
以下服务全部来自原站（afoim）的自建依赖，现已改为在**你自己的 Cloudflare 账号**上重建。

## 一、子域与源码对照

| 子域 | 用途 | 源码 | 部署形态 |
| --- | --- | --- | --- |
| `juluo.work` | 博客本体 | 本仓库 | Cloudflare Pages（构建命令 `pnpm build`，输出 `dist`） |
| `p.juluo.work` | 随机图 API（`/ri/h/{n}.webp`、`/ri/v/...`、`/count.json`） | [JuLuogo/Static_RandomPicAPI](https://github.com/JuLuogo/Static_RandomPicAPI)（fork） | Pages（先跑 `node build.js` 生成 `dist/`） |
| `img.juluo.work` | 文章配图 / 图床 | 无（R2 公开桶 + 自定义域） | R2 bucket + 自定义域 |
| `t.juluo.work` | 访问量统计（`tracker.js`、`/share`、`/batch`） | [JuLuogo/cf-umami](https://github.com/JuLuogo/cf-umami)（fork） | Workers + D1 |
| `icon.juluo.work` | 链接卡片元数据 API（`?url=`） | 原站未开源，需要新建 Worker（见第三节） | Workers |
| `nat.juluo.work` | NAT 类型检测后端（`/api/analyze`） | [JuLuogo/webrtc_check_nat](https://github.com/JuLuogo/webrtc_check_nat)（fork） | Workers |
| `e3.juluo.work` | 文件索引（可选） | [JuLuogo/CloudFlare-ImgBed](https://github.com/JuLuogo/CloudFlare-ImgBed)（fork） | Pages |

> 原站的 `eopfapi.acofork.com`（随机图）依赖腾讯 EdgeOne Pages Functions，
> `cnb.cool/2x.nz`（图片 CDN）是原作者的 CNB 命名空间，二者都不再使用：
> 随机图改由 `p.juluo.work` 承担，图片 CDN 已在 `scripts/cdnify-images.js` 中改为 jsDelivr。

## 二、部署后需要在 `src/config.ts` 打开的开关

```ts
export const randomImageConfig: RandomImageConfig = {
	enable: true,
	baseUrl: "https://p.juluo.work",
	max: 0, // 填 /count.json 里的 h 数量
};

export const viewCounterConfig: ViewCounterConfig = {
	enable: true,
	endpoint: "https://t.juluo.work",
};

export const linkCardApiConfig: LinkCardApiConfig = {
	enable: true,
	baseUrl: "https://icon.juluo.work",
};

export const oneDriveConfig: OneDriveConfig = {
	enable: true,
	apiBase: "https://e3.juluo.work/api/",
};

export const imageFallbackConfig: ImageFallbackConfig = {
	enable: true,
	originalDomain: "https://img.juluo.work",
	fallbackDomain: "https://img.juluo.work",
};
```

## 三、链接卡片元数据 Worker（原站未开源，需自建）

`src/plugins/rehype-component-url-card.mjs` 会请求 `${apiBase}/?url=<目标网址>`，
期望返回：

```json
{ "url": "…", "title": "…", "description": "…", "favicon": "https://…", "image": "" }
```

最小实现（Workers，`GET /?url=`）：抓取目标页 HTML → 解析 `og:title` / `og:description` /
`<title>` / `link[rel=icon]` → 返回上面的 JSON，并带上
`Access-Control-Allow-Origin: https://juluo.work` 与 5 分钟缓存。

## 四、部署所需凭据

需要一个 Cloudflare API Token（**注意：R2 的 S3 密钥不足以部署 Workers**），权限：

- Account：`Workers Scripts: Edit`、`Workers KV Storage: Edit`、`D1: Edit`、`R2: Edit`、`Pages: Edit`
- Zone（`juluo.work`）：`DNS: Edit`、`Zone: Read`

以及 R2 的 S3 凭据（Access Key ID / Secret Access Key，32/64 位）用于上传图片。

## 五、验证清单

- [ ] `https://juluo.work` 返回博客首页，`/privacy/`、`/friends/`、`/sponsors/` 可访问
- [ ] `https://p.juluo.work/count.json` 返回 `{"h":N,"v":M}`
- [ ] `https://t.juluo.work/share?pathname=/` 返回 `{"pathname":"/","views":N}`
- [ ] `https://icon.juluo.work/?url=https://astro.build` 返回 JSON
- [ ] `https://nat.juluo.work/api/analyze` 可用（POST）
- [ ] Giscus：仓库 [juluogo/giscus](https://github.com/juluogo/giscus) 已安装
      [giscus App](https://github.com/apps/giscus)，发文章后评论区能正常加载
- [ ] Umami Cloud 后台能看到 `juluo.work` 的访问数据
