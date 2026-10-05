# Workers 部署与 GitHub 自动构建

本站与所有自建服务都跑在 **Cloudflare Workers** 上（不用 Pages）。

## 一、当前已部署的 Workers

| Worker | 自定义域 | 说明 | 代码位置 |
| --- | --- | --- | --- |
| `peroe-blog` | `blog.juluo.work` | 博客本体（静态资源模式，`assets.directory=./dist`） | 本仓库根目录 `wrangler.jsonc` |
| `cf-umami` | `t.juluo.work` | 访问量统计（D1 `cf-umami`） | `github.com/JuLuogo/cf-umami` |
| `link-card` | `icon.juluo.work` | 链接卡片元数据 | 本仓库 `services/link-card/` |
| `random-pic` | `p.juluo.work` | 随机图 API（R2 桶 `juluo`） | 本仓库 `services/random-pic/` |

域内另有 Zone 级 301 规则：`juluo.work` 与 `www.juluo.work` → `https://blog.juluo.work`。

## 二、GitHub 连接（自动构建，推荐）

Workers 的 Git 连接目前只能在控制台点（API 未开放给本令牌），步骤：

1. 打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages>
2. 点 **`peroe-blog`** → **Settings** → **Builds** → **Connect**
3. 授权 GitHub，选择仓库 **`JuLuogo/fuwari`**、分支 **`main`**
4. 构建配置填：

   | 项目 | 值 |
   | --- | --- |
   | Build command | `pnpm install && pnpm update-diff && pnpm astro build --force` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |
   | 环境变量（可选） | `NODE_VERSION=22`、`PNPM_VERSION=9` |

   > `pnpm update-diff` 必须保留：它会生成 `src/json/git-history.json`，缺了构建会报
   > `Could not resolve "../json/git-history.json"`。
5. 保存后推一次提交（或在 Builds 页面点 **Retry deployment**）验证。

连接成功后，`git push` 到 `main` 就会自动构建并部署。

## 三、手动部署（备用）

```powershell
$env:CLOUDFLARE_API_TOKEN="<token>"
$env:CLOUDFLARE_ACCOUNT_ID="fad9d9a55ea63ee5f0b0d1d227e99293"

# 博客
pnpm update-diff
pnpm astro build --force
npx wrangler deploy

# 其他服务
cd services/link-card  ; npx wrangler deploy
cd services/random-pic ; npx wrangler deploy
```

## 四、注意事项

- `wrangler.jsonc` 是 **Workers** 配置（有 `assets` 字段）；如果误加 `pages_build_output_dir`
  会被当成 Pages 项目配置，`wrangler deploy` 会报 `does not support "assets"`。
- 博客的静态资源直接随 Worker 上传（约 120 个文件），不需要对象存储。
- 图片分两处放：随仓库的 `public/assets/images/`（跟随 Worker 部署），
  以及随机图/画廊用的 R2 桶 `juluo`（`ri/h/*`、`ri/v/*`，见 `services/random-pic/README.md`）。
