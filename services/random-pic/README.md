# random-pic（随机图 API）

博客 `src/config.ts` 的 `randomImageConfig` 指向本服务，图片存在 R2 桶里。

## 接口

| 路径 | 说明 |
| --- | --- |
| `GET /count.json` | `{"h":横屏数量,"v":竖屏数量}` |
| `GET /random?type=h\|v` | 302 跳到随机一张图 |
| `GET /ri/h/{n}.webp` | 返回图片（直接读 R2，带一年强缓存） |

## 放图

图片放在 R2 桶 `juluo`（`services/random-pic/wrangler.jsonc` 里的 `BUCKET` 绑定）的：

```
ri/h/1.webp   ri/h/2.webp   …   横屏
ri/v/1.webp   ri/v/2.webp   …   竖屏
```

上传方式（R2 的 S3 端点，Access Key 用 API 令牌 ID，Secret 用 `SHA256(令牌值)`）：

```powershell
# 用 rclone（推荐）
rclone config create r2 s3 provider Cloudflare \
  access_key_id <令牌ID> secret_access_key <SHA256(令牌值)> \
  endpoint https://<账号ID>.r2.cloudflarestorage.com
rclone copy .\ri r2:juluo/ri --progress
```

## 部署

```powershell
cd services/random-pic
$env:CLOUDFLARE_API_TOKEN="<token>"
$env:CLOUDFLARE_ACCOUNT_ID="fad9d9a55ea63ee5f0b0d1d227e99293"
wrangler deploy
```

部署后自定义域 `p.juluo.work` 会自动挂上。
