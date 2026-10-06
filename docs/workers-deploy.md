# 部署方式（Cloudflare 构建）

- 仓库：<https://github.com/juluowork/fuwari>（`main` 分支）
- Worker：`peroe-blog`，自定义域 <https://blog.peroe.cn>
- **构建与部署全部由 Cloudflare Workers Builds 负责**，GitHub 侧不再跑构建
  （`.github/workflows/deploy-workers.yml` 与 `dist` 产物分支均已删除）。

## 一、在控制台连接（一次配置，之后 push 即自动上线）

1. 打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages> → 选择 Worker **`peroe-blog`**
2. **Settings → Builds → Connect**
3. 填写：

   | 项目 | 值 |
   | --- | --- |
   | Git 仓库 | `juluowork/fuwari` |
   | 分支 | `main` |
   | Build command | `pnpm update-diff && pnpm astro build --force` |
   | Deploy command | `npx wrangler deploy`（默认值，不用改） |
   | Root directory | `/`（默认） |

4. （可选）**Settings → Builds → Build Variables and Secrets** 里加 `PNPM_VERSION=9.14.4`，
   与仓库 `pnpm-lock.yaml` 的 pnpm 版本保持一致（默认镜像是 pnpm 10，一般也能装）。
5. 保存后点 **Retry deployment**，或推一次提交验证。

### 为什么 Build command 是这两条

- **依赖安装不用写**：Workers Builds 会自动检测 lockfile 并安装依赖（想自己控制可设 `SKIP_DEPENDENCY_INSTALL=1`）。
- **`pnpm update-diff` 必须保留**：它生成 `src/json/git-history.json`，缺了构建会报
  `Could not resolve "../json/git-history.json"`。
- **`--force` 建议保留**：绕过 `node_modules/.astro/data-store.json` 的内容缓存，避免文章增删后输出旧内容。
- Node 版本由仓库根目录的 **`.nvmrc`（22）** 决定，无需在控制台配。

> 注意：按官方文档，Workers Builds **不读取** wrangler 配置里的自定义构建命令，
> 所以 Build command 只能在控制台填。

## 二、手动部署（本地备用）

```powershell
$env:CLOUDFLARE_API_TOKEN="<token>"
$env:CLOUDFLARE_ACCOUNT_ID="fad9d9a55ea63ee5f0b0d1d227e99293"

pnpm update-diff        # 生成 src/json/git-history.json（构建前置）
pnpm astro build --force
npx wrangler deploy     # 部署 Worker `peroe-blog`
```

其他服务：

```powershell
cd services/link-card ; npx wrangler deploy   # icon.peroe.cn
# 访问量统计代码在 https://github.com/juluowork/cf-umami（t.peroe.cn）
```

## 三、注意事项

- `wrangler.jsonc` 是 **Workers** 配置（`assets.directory = ./dist` + `routes` 自定义域），
  不要再加 `pages_build_output_dir`，否则会被当成 Pages 项目配置而报错。
- 文章配图直接放仓库（`public/assets/images/` 或文章同目录），随构建分发，不需要图床。
- 想恢复「GitHub 构建、Cloudflare 只拉产物」的老方案：从 git 历史里找回
  `scripts/publish-artifact.mjs`、`scripts/artifact/` 与 `.github/workflows/deploy-workers.yml`。

## 四、常见问题

**「该 GitHub 账号已连接到其他 Cloudflare 账号」**

Cloudflare 官方限制：一个 GitHub 账号（个人或组织）只能指向一个 Cloudflare 账号。
本仓库已迁到组织 **`juluowork`**，用**组织身份**安装 GitHub App 就能连当前 Cloudflare 账号，
不受你个人账号绑定关系影响：

1. 在 Connect 页面点 **+ Add account** → 选 `juluowork` → Install & Authorize
2. 只授权需要的仓库（`fuwari` 即可）

若仍报错，检查 GitHub 侧安装范围：
<https://github.com/settings/installations>（个人）或
`https://github.com/organizations/juluowork/settings/installations`（组织）。
