# link-card（链接卡片元数据服务）

博客文章里的 `::url{href="https://example.com"}` 语法会渲染成链接卡片，
卡片会向本服务请求元数据（原站 `icon.2x.nz` 没有开源，这里是按插件的接口约定重写的）。

## 接口

```
GET https://icon.juluo.work/?url=https://example.com
```

返回：

```json
{
  "url": "https://example.com/",
  "title": "Example",
  "description": "站点描述",
  "image": "https://example.com/og.png",
  "favicon": "https://example.com/favicon.ico"
}
```

- 只允许 `http` / `https`，并屏蔽 localhost、内网段、`169.254.*` 等地址（防 SSRF）。
- 响应缓存 10 分钟（`Cache-Control: public, max-age=600`），同时用 Cloudflare 边缘缓存。
- CORS 只对 `ALLOWED_ORIGINS` 里列出的来源放开（见 `wrangler.jsonc`）。

## 部署

```powershell
cd services/link-card
$env:CLOUDFLARE_API_TOKEN="<你的 token>"
$env:CLOUDFLARE_ACCOUNT_ID="fad9d9a55ea63ee5f0b0d1d227e99293"
wrangler deploy
```

部署后把博客 `src/config.ts` 里的开关打开：

```ts
export const linkCardApiConfig: LinkCardApiConfig = {
	enable: true,
	baseUrl: "https://icon.juluo.work",
};
```
