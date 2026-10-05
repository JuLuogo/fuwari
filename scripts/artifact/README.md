# 构建产物分支（`dist`）

⚠️ **本分支由 CI 自动生成，请勿手动修改** —— 每次推送 `main` 后会被强制覆盖。

- 由 [`.github/workflows/deploy-workers.yml`](../.github/workflows/deploy-workers.yml) 通过
  `scripts/publish-artifact.mjs` 生成
- 内容：`dist/`（构建好的静态站点）+ `wrangler.jsonc` + `package.json` + `.source-sha`
- 用途：让 **Cloudflare Workers Builds** 直接拉取现成产物部署，Cloudflare 侧不需要跑构建

## Cloudflare 侧怎么连（一次配置，之后全自动）

1. Workers & Pages → `peroe-blog` → **Settings → Builds → Connect**
2. 仓库选 `JuLuogo/fuwari`，分支选 **`dist`**
3. **Build command 留空**（产物已经构建好了）
4. Deploy command 保持默认 **`npx wrangler deploy`**
5. 保存

之后每次 `main` 有新提交 → Actions 构建 → 更新 `dist` 分支 → Cloudflare 自动拉取并部署。

> 想核对某次部署对应哪次提交，看分支里的 `.source-sha` 文件。
