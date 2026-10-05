# 部署方式

本站与所有服务都跑在 **Cloudflare Workers** 上。仓库：<https://github.com/juluogo/fuwari>（`main` 分支）。

目前有**两条并行的部署路径**，都在推送 `main` 后自动完成：

| 路径 | 触发 | 做什么 |
| --- | --- | --- |
| A. GitHub Actions 直接部署 | push `main` | 构建 → `wrangler deploy` 直接发到 Worker `peroe-blog` |
| B. 产物分支 + Cloudflare 拉取 | push `main` → Actions 更新 `dist` 分支 | Cloudflare Workers Builds 监听 `dist` 分支，检出后直接部署现成产物（**不重新构建**） |

> 两条路部署的是同一份产物；B 配好后如果你只想要 B，把 workflow 里的
> `Deploy to Cloudflare Workers` 步骤删掉即可。

## 一、路径 B：让 Cloudflare 拉取构建好的产物（推荐，零配置）

构建产物由 Actions 发布到独立的 **`dist` 分支**，内容是自包含的：

```
dist/            构建好的静态站点
wrangler.jsonc   Worker 配置（静态资源模式 + 自定义域）
package.json     只声明 wrangler（供 npx wrangler deploy 使用）
.source-sha      对应的源码提交
README.md        说明
```

Cloudflare 侧连接步骤（**Build command 留空**，因为它不需要构建）：

1. <https://dash.cloudflare.com/?to=/:account/workers-and-pages> → **`peroe-blog`** → **Settings** → **Builds** → **Connect**
2. Git 仓库选 `JuLuogo/fuwari`，**分支选 `dist`**（不是 main）
3. **Build command 留空**
4. Deploy command 保持默认 `npx wrangler deploy`
5. 保存

之后流程：push `main` → Actions 构建 → 强推更新 `dist` 分支 → Cloudflare 检出该分支 → `wrangler deploy` → 上线。

> 说明：Cloudflare 的 Git 连接只能在控制台点（API 的 `builds/workers*` 对当前令牌返回 401）。
> 另外按官方文档，Workers Builds **不读取** wrangler 配置里的自定义构建命令，所以「把构建配置写进仓库文件」
> 是做不到的；改用产物分支后，Cloudflare 侧确实什么都不用填。

## 二、路径 A：GitHub Actions 直接部署（当前已启用）

工作流：[`.github/workflows/deploy-workers.yml`](../.github/workflows/deploy-workers.yml)

```
push main → pnpm install --frozen-lockfile → pnpm update-diff → pnpm astro build --force
          → wrangler deploy（直接上线）
          → node scripts/publish-artifact.mjs（更新 dist 分支）
```

Secrets（已配置）：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
也可在 Actions 页面手动 **Run workflow**。

## 三、手动部署（本地备用）

```powershell
$env:CLOUDFLARE_API_TOKEN="<token>"
$env:CLOUDFLARE_ACCOUNT_ID="fad9d9a55ea63ee5f0b0d1d227e99293"

pnpm update-diff        # 生成 src/json/git-history.json（构建前置，缺了会报错）
pnpm astro build --force
npx wrangler deploy     # 部署 Worker `peroe-blog`

# 只发布产物分支（不部署）
node scripts/publish-artifact.mjs --branch dist --remote origin
```

其他服务：

```powershell
cd services/link-card ; npx wrangler deploy   # icon.juluo.work
# 访问量统计代码在 https://github.com/JuLuogo/cf-umami（t.juluo.work）
```

## 四、注意事项

- `wrangler.jsonc`（main 分支）是 **Workers** 配置（`assets.directory = ./dist` + `routes` 自定义域），
  不要再加 `pages_build_output_dir`，否则会被当成 Pages 项目配置而报错。
- **`pnpm update-diff` 不能省**：它生成 `src/json/git-history.json`，缺失时构建会报
  `Could not resolve "../json/git-history.json"`。
- 大批量增删文章后要加 `--force`，否则 Astro 会用 `node_modules/.astro/data-store.json` 里的旧内容。
- 文章配图直接放仓库（`public/assets/images/` 或文章同目录）随构建分发，不需要图床。
- `dist` 分支是**机器生成**的，别手动改；每次 push 都会被强制覆盖（`--force`）。
