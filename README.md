# peroe 的博客

基于 [Fuwari](https://github.com/saicaca/fuwari) 二次开发的个人博客。

- 站点：<https://blog.juluo.work>（根域 `juluo.work` 保留给自建服务与跳转）
- 仓库：<https://github.com/juluowork/fuwari>
- 上游定制版：[afoim/fuwari](https://github.com/afoim/fuwari)

> 本仓库已做过个性化改造：移除论坛模块、接入 Umami Cloud 统计、使用 Giscus 评论、
> 清理原作者的自建服务与推广跳转。二次开发前建议具备一定 Astro / 前端工程经验。

## ✨ 核心能力

- 高性能静态站点（Astro 5）
- 响应式布局与深色主题 / 彩虹模式
- Markdown / MDX 内容发布与增强渲染
- 全文检索、文章目录、阅读时长、更新提醒
- 代码块增强（行号、折叠、复制按钮扩展）
- 多模块页面：归档、友链、赞助、画廊、文件索引、封面生成
- SEO 与分发：RSS、Sitemap、Robots
- 维护脚本：新建文章、图片清理、命名规范化、AI 摘要、差异更新

## 🛠️ 技术栈

- **框架**：Astro 5.x
- **交互**：Svelte 5
- **样式**：Tailwind CSS + Stylus
- **内容处理**：Remark / Rehype 扩展链路
- **代码高亮**：Expressive Code
- **包管理**：pnpm
- **代码规范**：Biome

## 🚀 快速开始

```bash
pnpm install     # 安装依赖
pnpm dev         # 本地开发（http://localhost:4321）
pnpm build       # 构建（生成 src/json/git-history.json 后才能正常构建）
pnpm preview     # 预览构建产物
```

> 首次构建前先执行一次 `pnpm update-diff` 生成 `src/json/git-history.json`；
> 大批量删除文章后，请用 `pnpm astro build --force` 绕过 Astro 内容缓存。

## 📌 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建静态站点 |
| `pnpm preview` | 预览构建产物 |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm new-post <slug>` | 新建文章 |
| `pnpm update-diff` | 生成文章变更历史 |
| `pnpm clean` | 清理未引用图片 |
| `pnpm del-space` | 规范图片命名并更新引用 |
| `pnpm ai-summary` | 生成文章 AI 摘要（需要 `GEMINI_API_KEY`） |
| `pnpm cdnify` | 将图片引用指向 CDN |

## ⚙️ 配置指南

主要配置入口是 [`src/config.ts`](src/config.ts)，包括：

- 站点标题、描述、关键词、语言、主题色
- 头像、昵称、简介、联系方式（QQ / GitHub / Email）
- 导航菜单、Banner、背景图
- 统计（Umami Cloud）、评论（Giscus）、Cookie 同意
- 随机图 API、链接卡片 API、OneDrive 索引、文章浏览量等自建服务开关

其它内容目录：

| 目录 | 用途 |
| --- | --- |
| `src/content/posts/` | 文章（Markdown） |
| `src/content/spec/announcement.md` | 站点公告 |
| `src/data/friends/` | 友链数据（见目录内 README） |
| `src/data/sponsors/` | 赞助记录（见目录内 README） |
| `src/data/timetable/` | 课表数据（见目录内 README） |
| `public/sponsors/` | 收款码图片 |

构建行为与 Markdown 管线在 [`astro.config.mjs`](astro.config.mjs) 中调整。

## 📁 项目结构

```text
├── public/                 # 静态资源
├── src/
│   ├── components/         # 页面与功能组件
│   ├── content/            # 文章与公告
│   ├── data/               # 友链 / 赞助 / 课表
│   ├── layouts/            # 页面布局
│   ├── pages/              # 路由页面
│   ├── plugins/            # Remark / Rehype / 代码块插件
│   ├── styles/             # 全局样式
│   ├── types/              # 类型定义
│   └── config.ts           # 核心配置
├── scripts/                # 维护与自动化脚本
└── package.json
```

## 🌐 部署

静态输出，可部署到任意静态托管平台（Cloudflare Pages / Vercel / Netlify 等）。
仓库内 `wrangler.jsonc` 已按 Cloudflare 配置好默认资源目录。

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- 上游模板：[saicaca/fuwari](https://github.com/saicaca/fuwari)
- 定制版参考：[afoim/fuwari](https://github.com/afoim/fuwari)
