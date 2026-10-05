# 部署方式

本站与所有服务都跑在 **Cloudflare Workers** 上。仓库：<https://github.com/juluogo/fuwari>（`main` 分支）。

## 一、自动部署（已配置 ✅）

**推送到 `main` 就会自动构建并部署**，由 [`.github/workflows/deploy-workers.yml`](../.github/workflows/deploy-workers.yml) 完成：

```
push main → pnpm install --frozen-lockfile → pnpm update-diff → pnpm astro build --force → wrangler deploy
```

所需仓库 Secrets 已经写好了（Settings → Secrets and variables → Actions）：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 部署 Worker |
| `CLOUDFLARE_ACCOUNT_ID` | 目标账号 |

也可以在仓库 **Actions → Deploy to Cloudflare Workers → Run workflow** 手动触发。

> 为什么不直接用 Cloudflare 控制台的 Git 连接（Workers Builds）？
> 那个连接只能在控制台点（Cloudflare API 的 `builds/workers*` 接口对当前令牌返回 401，无法自动化创建）。
> 用 GitHub Actions 效果等价：推代码即上线。若你更喜欢控制台方案，步骤见文末。

## 二、手动部署（备用）

```powershell
$env:CLOUDFLARE_API_TOKEN="<token>"
$env:CLOUDFLARE_ACCOUNT_ID="fad9d9a55ea63ee5f0b0d1d227e99293"

pnpm update-diff        # 生成 src/json/git-history.json（构建前置，缺了会报错）
pnpm astro build --force
npx wrangler deploy     # 部署 Worker `peroe-blog`
```

其他服务：

```powershell
cd services/link-card ; npx wrangler deploy   # icon.juluo.work
# 访问量统计的代码在 https://github.com/JuLuogo/cf-umami（t.juluo.work）
```

## 三、注意事项

- `wrangler.jsonc` 是 **Workers** 配置（`assets.directory = ./dist` + `routes` 自定义域），
  不要再加 `pages_build_output_dir`，否则会被当成 Pages 项目配置而报错。
- **`pnpm update-diff` 不能省**：它生成 `src/json/git-history.json`，缺失时构建会报
  `Could not resolve "../json/git-history.json"`。
- 大批量增删文章后要加 `--force`，否则 Astro 会用 `node_modules/.astro/data-store.json` 里的旧内容。
- 文章配图直接放仓库（`public/assets/images/` 或文章同目录）随构建分发，不需要图床。

## 四、附：用 Cloudflare 控制台连 Git（可选）

1. <https://dash.cloudflare.com/?to=/:account/workers-and-pages> → **`peroe-blog`** → **Settings** → **Builds** → **Connect**
2. 选仓库 `JuLuogo/fuwari`、分支 `main`
3. Build command：`pnpm install && pnpm update-diff && pnpm astro build --force`
   Deploy command：`npx wrangler deploy`

> 两种方式同时开启会重复部署（一次来自 Actions，一次来自 Cloudflare），建议二选一。
