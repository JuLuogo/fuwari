# 文章写作规范

本文件是本站（<https://blog.juluo.work>）所有文章的写作契约。写文章前先通读一遍。

## 一、选题

- 方向：计算机 / IT / 网络，**个人向技术实践**（自己折腾过、能给出取舍和踩坑经验的那种）。
- 一篇文章讲清一件事，**不要把一个主题硬拆成多篇**，也不要写「50 个字就完事」的短贴。
- 同一时间写的文章**选题不要扎堆**：例如不要连续 5 篇都写 CDN，穿插开（CDN / DNS / 反代 / 内网穿透 / Linux / Docker / 自建服务 / 安全 / 前端 / 效率 / 硬件网络 / AI 工具……）。
- 每篇都要有「为什么这么做」和「我踩过什么坑」，不要写成官方文档的搬运或纯命令清单。
- 涉及第三方数据（测速、评分、检测结果）必须是**自己实测的截图**，数字要跟图上一致。

## 二、文件与命名

| 项目 | 规范 |
| --- | --- |
| 文章文件 | `src/content/posts/<slug>.md`，slug 用小写英文 + 连字符，如 `cloudflare-workers-static-site.md` |
| 配图目录 | `public/assets/images/posts/<slug>/`（与 slug 同名） |
| 图片命名 | `01-<英文或拼音简述>.webp`、`02-...`，按文中出现顺序编号 |
| 图片格式 | 统一 **WebP**（截图先用 PNG，再用工具转 WebP），单张控制在 ~300KB 内 |
| 图片引用 | `![简短说明](/assets/images/posts/<slug>/01-xxx.webp)`（以 `/` 开头，走 public 目录，构建后直接可用） |

## 三、Frontmatter（严格按 schema，不要加字段）

```yaml
---
title: 用 Cloudflare Workers 托管静态博客并接上自定义域名   # ≤ 40 字，别用问号堆砌
published: 2026-10-05 21:30:00 +08:00  # ⚠️ 必须带 +08:00，见下方说明
updated: 2026-10-06 10:00:00          # 可选，改过内容再填
description: 从零把 Astro 静态站点部署到 Workers：资源绑定、自定义域、缓存与踩坑记录。  # 60~120 字，概括全文
tags:                                  # 2~4 个，复用已有标签优先
  - Cloudflare
  - 部署
image: ""                              # 可选；留空或用 'random'（随机封面）
pinned: false                          # 只有置顶公告类才 true
lang: ""                               # 中文文章留空即可
draft: false                           # 发布即 false
---
```

## 四、正文结构（推荐模板）

```markdown
一句话说明这篇要解决什么问题（场景 + 痛点，1~3 行）。

> [!NOTE]
> 需要的前置条件：系统/版本/账号/权限，一句话讲清。

## 为什么要这么做（或：问题是什么）

讲背景与方案取舍，给出你选的方案和理由。

## 具体步骤

### 1. 第一步（小标题要能一眼看懂做了什么）

命令/配置 + **关键处配图**。

```bash
# 命令示例：注释用中文
```

### 2. 第二步
...

## 验证结果

放实测数据与截图（测速、评分、页面效果）。

## 踩坑与注意事项

- 坑 1：现象 → 原因 → 解决
- 坑 2：...

## 小结

3~5 行，回收结论；可给出适用/不适用场景。
```

要求：

- 篇幅：正文 **1200~3500 字**（不含代码）。低于 1000 字的选题直接放弃或合并。
- **图片：每篇至少 2 张**，其中至少 1 张是真实截图（网站/面板/工具/自己站点），关键步骤必须有图；
  纯终端输出可用「终端风格渲染图」，但**不能全篇都是渲染图**。
- 代码块必须标语言（`bash` / `nginx` / `yaml` / `json` / `ts` / `dockerfile` …）。
- 提示块用 GitHub 风格：`> [!NOTE]`、`> [!TIP]`、`> [!WARNING]`、`> [!CAUTION]`。
- 站内互链用 `/posts/<slug>/`；外链直接写完整 URL。
- 可用的自定义指令：
  - `::github{repo="owner/repo"}` —— GitHub 仓库卡片
  - `::url{href="https://example.com"}` —— 链接卡片（会去 `icon.juluo.work` 抓元数据）
- 不要出现「本文由 AI 生成」之类的话；也不要写「如有错误欢迎指正」这种空话结尾。

## 五、截图工具（本机 Chrome，已装好）

工具目录：`C:\Users\juluo\.dsh-tools\shots\`（`playwright-core` + 本机 Chrome，无头会被 Cloudflare 挡，**一律加 `--headed`**）。

### 1. 网页截图 `shot.mjs`

```powershell
cd C:\Users\juluo\.dsh-tools\shots

# 普通页面（含 Cloudflare 验证的站点用 --headed + 独立 profile）
node shot.mjs --url "https://example.com" --out "D:\shots\01-home.png" `
  --width 1500 --height 950 --wait 4000 --headed --profile "$env:TEMP\chrome-a1"

# 填表单 + 点按钮 + 等结果（测速类）
node shot.mjs --url "https://www.tcptest.cn/ping" --out "D:\shots\02-ping.png" `
  --width 1500 --height 1100 --headed --profile "$env:TEMP\chrome-a1" `
  --fill "input[type=text]" --value "blog.juluo.work" `
  --click "text=单次测试" --after-click 3000 `
  --wait-for "text=全部节点" --wait-for-timeout 90000 `
  --click2 "text=关闭广告" --hide ".advertisement-banner"

# 只截某个元素（例如结果表格）
node shot.mjs --url "<url>" --out out.png --selector "#china_region" --scale 2 --headed
```

常用参数：`--full`（整页）、`--scale 2`（高清）、`--selector`（元素级）、`--hide ".a,.b"`（隐藏广告）、
`--mobile`（手机视图）、`--scroll 800`、`--proxy http://127.0.0.1:7890`（访问需要代理的站点）。

> ⚠️ 并行注意：同一时间只能用**一个** Chrome 实例占用同一个 profile 目录。
> 多个任务并行时给每个任务分配不同的 `--profile "$env:TEMP\chrome-<名字>"`。

### 2. 本地 HTML 渲染成图 `render.mjs`（终端窗口 / 配置卡片 / 简易架构图）

先写一个 HTML 片段（内联样式），再渲染：

```powershell
node render.mjs --html "D:\shots\terminal.html" --out "D:\shots\03-terminal.png" --width 1000 --scale 2
```

终端风格 HTML 参考骨架（可直接改内容）：

```html
<div style="margin:0;background:#1e1e2e;padding:28px 32px;font-family:'Cascadia Mono',Consolas,monospace;color:#cdd6f4;font-size:15px;line-height:1.7;width:1000px">
  <div style="display:flex;gap:8px;margin-bottom:16px">
    <span style="width:12px;height:12px;border-radius:50%;background:#f38ba8"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#fab387"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#a6e3a1"></span>
  </div>
  <div><span style="color:#a6e3a1">$</span> dig +short blog.juluo.work</div>
  <div>104.21.6.247</div>
</div>
```

### 3. PNG 转 WebP `to-webp.py`

```powershell
& "C:\Users\juluo\.dsh\...\python.exe" "C:\Users\juluo\.dsh-tools\shots\to-webp.py" "D:\shots" --quality 82 --max-width 1600
```

### 4. 探测辅助（不确定选择器时用）

- `probe-form.mjs --url <url> --headed`：列出输入框/按钮
- `probe.mjs --url <url> --text "关键词"`：找包含某文字的容器（给 `--selector` 用）
- `probe-overlay.mjs --url <url>`：找广告/浮层（给 `--hide` 用）

### 5. 好用的公开截图素材站（都能直接截）

| 用途 | 地址 |
| --- | --- |
| 多节点 Ping / Tcping / DNS / 路由追踪 | <https://www.tcptest.cn/ping>、`/tcping`、`/dns`、`/traceroute` |
| HTTPS 评分 | <https://www.ssllabs.com/ssltest/analyze.html?d=blog.juluo.work> |
| 安全响应头 | <https://securityheaders.com/?q=blog.juluo.work> |
| 网页性能 | <https://pagespeed.web.dev/analysis?url=https://blog.juluo.work/> |
| DNS 传播 | <https://dnschecker.org/#A/blog.juluo.work> |
| 证书透明度 | <https://crt.sh/?q=juluo.work> |
| Cloudflare 状态 | <https://www.cloudflarestatus.com/> |
| Cloudflare 测速 | <https://speed.cloudflare.com/> |
| 自己站点 | <https://blog.juluo.work/> 各页面 |

## 六、写作完成后必须做的检查

1. `pnpm build` 通过（图片路径写错会 404 但不报错，所以要**人工核对**图片是否都在 `public/assets/images/posts/<slug>/` 下）。
2. 每个 `![](...)` 引用的文件真实存在。
3. frontmatter 能被 schema 解析（`published` 必须是合法日期）。
4. 提交信息格式（`AGENTS.md` 规定）：
   `posts:发布新文章《标题》。一句话摘要。`

## 七、不要做的事

- ❌ 复制粘贴他人文章内容；引用他人结论要标明来源链接。
- ❌ 用外站图片直链（可能失效/盗链），一律自己截图或自己渲染。
- ❌ 编造没验证过的命令输出（终端图必须来自真实命令执行结果）。
- ❌ 一篇文章塞多个不相关主题；也不要为了凑字数灌水。

## 八、实战踩坑（写文章前必看）

1. **`published` / `updated` 必须带 `+08:00`**。
   YAML 会把不带时区的 `2026-10-05 21:20:00` 直接解析成 **UTC** 时间，页面按 `Asia/Shanghai` 渲染后
   就变成次日 05:20，看起来像排期到了明天。正确写法：`published: 2026-10-05 21:20:00 +08:00`。
   （`date-utils.ts` 里对「带引号的纯字符串」也做了按北京时间解释的兜底，但别依赖它。）
2. **图片按「正文出现顺序」编号**：正文里第 1 张图必须是 `01-xxx.webp`。写完后通读一遍顺序再定文件名，
   否则改起来要连带改引用。
3. **图片引用必须是绝对路径**：`/assets/images/posts/<slug>/01-xxx.webp`，不要写相对路径。
4. **终端类插图要用真实执行过的命令输出**：Windows 上 `tracert -d`、`ping -n 20`、`curl -sI`、`openssl s_client`
   都能直接跑；把输出丢进 `render.mjs` 渲染成图。
5. **不确定的按钮文字先用 `probe-form.mjs` 探测**：例如 tcptest.cn 的是「单次测试」「开始查询」，
   不是「开始测试」。测速/查询类站点记得 `--click2 "text=关闭广告"` 去掉广告浮层。
6. **并发截图要给每个任务分配独立 profile**（`--profile "$env:TEMP\chrome-<名字>"`），
   同一 profile 同时只能有一个 Chrome；工具已内置「启动前清理同 profile 残留进程」。
