---
title: 静态博客怎么显示每篇文章的浏览量：从 D1 读数接口到前端排序的完整链路
published: 2026-10-05 22:15:00 +08:00
description: 静态站没有后端，文章卡片上的浏览量到底从哪来？这篇拆我自己这套链路：D1 里只有 pathname + views 两列、两个读接口的分工、前端如何一次批量取数并先藏后显避免抖动、列表页按热度排序的索引对齐，以及防刷与缓存口径的取舍。
tags:
  - 建站
  - Astro
  - 统计
pinned: false
draft: false
---

静态博客最难的不是写页面，是**页面之外的数字**：每篇文章有多少人看过、全站累计多少。这些数字不在文件系统里，也不在构建产物里——你得去某个地方把它读回来。

我这套的分工是：**上报**交给 Umami Cloud 的官方脚本（有后台、有地域和设备维度），**展示**用自己写的一个只读接口（`t.juluo.work` + D1）。本文只讲后者：从 D1 里那张两列的表，到文章页 meta 行里的「0 次」，再到列表页点一下眼睛图标就按热度重排。代码都在这个仓库里，接口行为全部用本机 curl 和 Chrome 实测过。

> [!NOTE]
> 前置：本站是 Astro 静态站，跑在 Cloudflare Worker 的静态资源模式上（没有 `main`、没有服务端逻辑，构建产物直接由边缘节点分发），域名 `blog.juluo.work`；读数接口是另一个 Worker `cf-umami`（源码在公开仓库 `juluowork/cf-umami`），数据存在 D1 的 `pageviews` 表。展示侧的开关就两个字段，写在 `src/config.ts` 里：

```ts
// 文章/页面浏览量：自建统计服务（Cloudflare Worker + D1，部署在 t.juluo.work）
export const viewCounterConfig: ViewCounterConfig = {
	enable: true,
	endpoint: "https://t.juluo.work",
};
```

## 先看这套东西现在的样子

![线上文章页标题下方的 meta 行：发布时间旁边是浏览量图标和「0 次」，这个数字是页面加载后由客户端从 t.juluo.work 读回来的。](/assets/images/posts/blog-view-counter/01-post-page-view-count.webp)

文章页的标题下面那行 meta：发布时间、浏览量图标加一个「0 次」。这个数字不是构建时写死的——**看组件模板就知道**（下面贴的是 `PostMeta.astro` 的源码，不是渲染后的 HTML），它渲染出来就是个空壳，`slug` 是文章 id：

```html
<div class="flex items-center" id={`page-views-wrapper-${slug}`} style="display: none;">
    <div class="meta-icon">
        <Icon name="material-symbols:visibility-outline-rounded" class="text-xl"></Icon>
    </div>
    <span class="text-50 text-sm font-medium" id={`page-views-${slug}`}></span>
</div>
```

![线上首页：每张文章卡片下面都有一个「0 次」，右上角是按日期／按访问量切换的排序控件，左侧栏的「访问量」显示 0。](/assets/images/posts/blog-view-counter/02-home-list-sort-and-site-views.webp)

首页同样，每张卡片下挂着一个「0 次」，右上角多了排序控件。**顺便注意侧栏**：首页有「访问量 0」，文章页没有——这不是设计，是实现细节，放在「踩坑」里说。

真正值得在意的不是 0，而是**为什么会是 0**：读数接口一路通着（下面有实测），却没有任何页面在往计数表里写。这套系统现在处于「只读不写」的状态，最后再展开。

## 为什么不用第三方统计的 API

最省事的做法是前端直接去第三方统计的分享页拉数字。我没选，理由都跟「展示」这个场景的特殊性有关：

1. **分享页是给人看的页面，不是给浏览器 fetch 的接口。** 它属于统计后台的一部分，渲染方式随时可能变，而文章卡片要长期依赖它的响应结构——绑得越紧越难拆。
2. **跨域和配额都不在我手里。** 读数请求要从 `blog.juluo.work` 打到别人的域上，失败时我连「为什么失败」都看不到——是 CORS、是限流，还是接口改了。
3. **展示只需要一个整数。** 来源、设备、停留时长这些留在统计后台看就好，为了一个数字去拉一个通用分析接口，是拿大炮打蚊子。

自建的代价也很实在：多一个 Worker、多一张表、多一处要维护的东西。但它的**失效模式是干净的**：接口挂了，博客照常打开，只是数字不显示（我实测过，见后面的失败兜底）。

## 数据表：只有两列，是刻意的

D1 里的建表语句就一行（来自 `cf-umami` 仓库的 `src/index.ts`，我用 curl 核对过部署版本返回的错误字符串，行为与它一致）：

```sql
CREATE TABLE IF NOT EXISTS pageviews (pathname TEXT PRIMARY KEY, views INTEGER NOT NULL);
```

写入也只有一句 UPSERT：

```sql
INSERT INTO pageviews(pathname, views) VALUES(?, 1) ON CONFLICT(pathname) DO UPDATE SET views = views + 1;
```

`pathname` 直接当主键，`views` 就是个整数计数。**没有 IP、没有 UA、没有 session、没有时间戳。** 这不是偷懒，是取舍：

- 好处：表小，查询就是一次主键查，不存任何可识别信息，连「匿名化」这一步都省了。
- 代价：UV、来源、停留时长、趋势曲线一概没有，这些交给 Umami。

另一个直接后果是**路径必须规范化**。同一个页面只要能通过两个 URL 打开，计数就会裂成两条。我的文章页只有 `/posts/<slug>/` 一种形态，工具页统一用组件里写死的 `pathname`（比如 `/tools/cover/` 这个页面，实际读写的路径是 `/cover/`——实测抓到的请求就是 `GET /share?pathname=%2Fcover%2F`），所以这件事暂时没炸。

## 接口契约：两个读接口，一个写接口

![本机 curl 实测：/share 单读返回 views、/batch 的裸数组请求体与同序返回、传对象时 400，以及 CORS 只对本站来源回 ACAO、/send 对外域来源静默 204。](/assets/images/posts/blog-view-counter/03-curl-share-batch.webp)

三个端点用 curl 跑一遍，下面是线上真实响应：

- `GET /share?pathname=/posts/xxx/` → `{"pathname":"/posts/xxx/","views":0}`，单个页面读数；参数缺失返回 `{"ok":false,"error":"invalid_pathname"}`。
- `POST /batch`，请求体是**裸 JSON 数组** `["/","/posts/xxx/"]`，返回**同序数组** `[0,0]`；传对象进去会被拒：`{"ok":false,"error":"expected_array"}`（HTTP 400）。
- `POST /send`，单个写入，请求体是 `{"pathname":"/"}`，只接受来自本站 Origin/Referer 的请求，其他来源直接 **HTTP 204 静默丢弃**。

> [!WARNING]
> Windows PowerShell 会把命令行里内联 JSON 的双引号吃掉。`--data-raw '["/"]'` 实际只发出了 3 个字节，接口回 `{"ok":false,"error":"invalid_json"}`；把请求体写进文件、用 `--data-binary "@file"` 才能正常测通。我第一次测 `/batch` 就被它坑了，差点以为接口不认数组。

**为什么读数用 POST 而不是 GET。** 语义洁癖会说「读操作该用 GET」，但这套接口要一次读 N 个路径：GET 只能靠 `?pathname=a&pathname=b` 或者逗号分隔，URL 长度、编码、去重规则全得自己定；POST + JSON 数组能把「顺序」表达得最清楚——**顺序就是契约**，讲排序时你会看到它有多关键。副作用是 POST 天然不可缓存，每次浏览都真的打一次查询，好处是数字永远新鲜。

## 前端：一次批量读，先藏后显

![仓库里 src/components/ViewsCounter.astro 的关键代码：wrapper 默认 display:none，fetch /share 成功后写入「N 次」并改成 flex。](/assets/images/posts/blog-view-counter/04-views-counter-code.webp)

上图是单页读数组件 `src/components/ViewsCounter.astro`，用在工具页、课程表这类没有文章卡的页面上：`/share` 读一个路径、写进 span、把 wrapper 从 `display: none` 改成 `flex`。

**关键在「藏」这个动作上。** 组件渲染出来的 wrapper 带 `style="display: none;"`，服务端渲染阶段它就是个不占位的空壳，数字是客户端拿到之后才亮的。如果先渲染一个「0 次」占位、等接口回来再换成「1234 次」，用户会看到数字跳变，数字宽度变化还会把整行 meta 往前推一下——比晚半秒出现难看得多。代价是这一行从无到有时，下面的内容会有一次小位移，但至少**不会有错误的数字被看到**。

实测：工具页整页只发出 **1 个**请求 `GET /share?pathname=%2Fcover%2F`，然后 span 里出现「0 次」。

文章页和列表页走的是另一条路——批量读（`src/components/PostMeta.astro`）。一页最多 8 张卡片（`src/constants/constants.ts` 里的 `PAGE_SIZE = 8`），每张各发一个 `/share` 就是 8 个请求，既慢又费额度。实现是一个「注册队列 + 一次性取数」的机制——注意它**不是并发发起 N 个请求，而是把 N 个路径压进同一个请求**：

```js
// 注册需要获取访问量的文章
if (!window.__VIEWS_QUEUE__) {
    window.__VIEWS_QUEUE__ = [];
    window.__VIEWS_FETCHED__ = false;
}
window.__VIEWS_QUEUE__.push(slug);

// 批量获取访问量
async function batchFetchPageViews() {
    // 如果已经获取过或者有排序脚本在处理，跳过
    if (window.__VIEWS_FETCHED__ || window.__PAGE_POSTS_DATA__) return;
    window.__VIEWS_FETCHED__ = true;

    const slugs = window.__VIEWS_QUEUE__;
    if (!slugs.length) return;

    try {
        const pathnames = slugs.map(s => `/posts/${s}/`);
        const response = await fetch(`${viewsEndpoint}/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(pathnames),
        });
```

两个守卫缺一不可：`__VIEWS_FETCHED__` 防止每张卡片各发一次请求（页面上有几张卡片，这段脚本就会被内联几份），`__PAGE_POSTS_DATA__` 则是在列表页让位给排序脚本，避免同一份数据被拉两遍。抓包实测：**写作时（2026-10-05 晚）线上首页是 6 张卡片**，发往 `t.juluo.work` 的请求**只有 1 条**——`POST /batch`，请求体是 7 个路径（`/` 加 6 篇文章）。文章页同样只有 1 条，请求体是那篇文章自己的路径。PostMeta 只有这一条批量路径，即使文章页只需要读一个路径，它走的也是 `/batch`——组件逻辑只有一套，这是取舍。代价也在这句话里：只要其中**任意一个** pathname 不合法，整个 `/batch` 就返回 400（实测：数组里混进一个不以 `/` 开头的路径，整批请求直接失败），那一页的数字会全部不显示——「全对才给」的严格口径，换来的是前端永远不用处理"部分成功"。

> [!NOTE]
> 「6 张卡片、7 个路径」只是那一刻的快照，别当成固定值：请求体长度永远等于**线上文章数 + 1**（多出来的 `/` 是侧栏那个全站访问量）。写作时仓库里前后一共出现过 8 篇文章——5 篇已上线、3 篇当时还没发，其中一篇当晚还被删掉了；文章数一变，这个数字就跟着变。

## 列表页按热度排序：索引对齐才是真难点

![仓库里 src/scripts/post-list-sort.ts 的关键代码：把全站路径和当前页所有文章路径拼成一个数组、一次批量读，再按返回值下标分给每篇文章，最后一段是访问量比较器。](/assets/images/posts/blog-view-counter/05-post-list-sort-code.webp)

列表页的排序完全在客户端做（`src/scripts/post-list-sort.ts`）。文章数据在构建时就被塞进页面：

```js
window.__PAGE_POSTS_DATA__ = pagePostsData;
```

这段在 `src/pages/[...page].astro` 里，`pagePostsData` 是 `id / title / published / pinned` 四个字段的精简对象。排序脚本拿到它之后一次读完，再靠**下标**把数字分回去：

- `views[0]` 是全站访问量，写进侧栏的 `#site-views`；
- `views[index + 1]` 才是第 `index` 篇文章的量，存进 `viewsData` 这个 Map，同时顺手把卡片上那个 span 填好。

排序在 `getSortedIndices()` 里：日期模式按 `published` 排（置顶优先），访问量模式按 Map 里的数字排；`render()` 不做 diff，直接把 `article` 元素按新顺序 `appendChild` 回容器——元素复用，只是顺序变了。

**这套实现的脆弱点恰恰是它的简洁**：请求数组、响应数组、`__PAGE_POSTS_DATA__` 三个顺序必须完全一致。任何一边多一个、少一个、乱一个，数字就会串到别的文章上，而且**不会报错**，你只会觉得数字"有点怪"。换成对象数组（`[{pathname, views}]`）当然更稳，但接口契约已经定了，眼下改它的收益不值这个工。

![把 /batch 的响应体替换成模拟数据后（页面代码未改），列表页按访问量排序的真实表现：6 张卡片排成 500/300/200/100/50/10，侧栏全站访问量 1234。](/assets/images/posts/blog-view-counter/06-home-sorted-by-views.webp)

这里有个尴尬的现实：线上所有计数都是 0，点「按访问量排序」看不出任何变化——每个比较都返回 0，而 V8 的 `sort` 是稳定的，顺序原样保留（只有按钮的 `active` 样式变了）。为了验证逻辑本身，我把 **`/batch` 的响应体在浏览器里换成了模拟数据**（页面代码一行没改，也没有往 D1 写任何东西）：

- 6 张卡片（就是当时首页那几张）按模拟计数从大到小重排：500 / 300 / 200 / 100 / 50 / 10，侧栏全站数变成 1234；
- 再点一次顺序按钮（「倒序」→「正序」），顺序整个反过来：10 / 50 / 100 / 200 / 300 / 500。

也就是说批量取数、下标映射、排序三件事都是通的。**唯一没验证的是真实非零数据**——那需要有人往表里写，而这正是现在缺的那一环。

## 防刷与缓存口径

**防刷。** 先说清楚：这套守卫**不是防刷，是防误写**。

- 读接口（`/share`、`/batch`）完全公开，任何人 curl 都能拿到数字。它只做了 CORS 白名单：带外域 Origin 请求时响应里根本没有 `Access-Control-Allow-Origin`（实测），浏览器会拦掉读取——但这拦不住 curl。
- 写接口 `/send` 会检查 Origin/Referer 的 host 是否等于配置的目标站点，不等就 204 静默丢弃。我拿一个没人访问的路径试过：带外域 Origin 时返回 204，随后用 `/share` 查该路径仍然是 `views: 0`，说明它确实没写进去。它拦的是「别的站把上报误打过来」，同样拦不住伪造 Origin 的脚本。
- 真要防刷得靠边缘的 WAF / 限速规则。而我这里是**读接口被刷**，代价只是 D1 的行读，真正要担心的是有人拿它刷用量，不是数据被篡改。

**缓存。** 实测两个读接口的响应头里**都没有 `Cache-Control`**（我用 `Select-String` 过滤响应头，一条都过滤不出来），而 POST 本身也不可缓存。所以每次浏览都会实打实打一次查询：数字永远新鲜，也意味着没有「缓存穿透」这类问题需要额外机制去补。

顺带一个反面样本：上报脚本 `/tracker.js` 是有缓存的（`Cache-Control: public, max-age=3600`），而它在页面上**一次都没被引用**——我 curl 了首页、文章页、归档、友链、赞助、隐私、工具几个页面，`tracker.js` 出现次数都是 0。所以现在的状态是：读接口跑得很勤，写接口准备好了但没人调用。

## 踩坑与注意事项

1. **文章页看不到侧栏的「全站访问量」，首页能看到。** 因为全站数字是排序脚本顺带取回来的（`views[0]`），而排序脚本只在列表页加载；文章页只有 PostMeta，它只取自己那一条。实测：首页 `#site-views-wrapper` 的 `display` 是 `grid`，文章页是 `none`。同一个侧栏组件，两个页面表现不一致。
2. **0 数据下的排序"看起来失效"。** 点按钮时 `active` 样式会变（说明事件绑上了），但顺序纹丝不动，因为比较器对所有组合都返回 0。**测排序逻辑不能只看线上表现**，得先把数据换成非零的。
3. **接口挂了要能安静地不显示。** 我把 `/batch` 分别换成 500 和「200 + 空响应体」测了一遍：列表页、文章页都不显示任何数字，页面其他部分完全正常，控制台的 `pageerror` 里也没有浏览量相关的报错。空响应体甚至专门 `throw new Error('Empty response')` 拦了一道，然后被同一个 `catch` 兜住。这个「宁可不显示，也不显示错的」兜底是免费的——因为渲染前就检查了 `res.ok`。
4. **`/batch` 是 N 次串行查询。** Worker 源码里就是一个 `for` 循环，每个 pathname 单独 `SELECT` 一次，没有用 `IN` 一次查回来；而且每次请求进来还会先跑一遍 `CREATE TABLE IF NOT EXISTS`。写作时首页那 7 个路径就是 7 次串行查询。现在文章少看不出差别，等文章上百篇，这就是最该先改的一处（一次 `IN` 查询 + 把建表检查挪出热路径）。
5. **与本文无关但顺手发现的一个报错**：线上页面控制台里一直有 `cookieConsentConfig is not defined`（Cookie 同意横幅那个脚本）。它不影响浏览量，但它说明客户端脚本的错误最容易长期潜伏——因为很少有人天天开着控制台看自己的博客。

## 收尾：给想抄这套的人一份清单

判断先放在前面：**静态博客要显示浏览量，下限方案是「一个只读接口 + 一次批量读 + 服务端渲染留空位」，而不是去引第三方统计的公开接口。** 展示和统计是两件事，混在一起做，哪天统计服务改个接口，你就得跟着改文章卡片。

但更值得记住的是这条：**显示链路和写入链路是两件独立的事。** 我这套现在读得又快又稳，数字却全是 0——因为没有页面上报。它不是 bug，是「先把读的那半截跑通、写的那半截还没接」的状态；接上 `tracker.js` 会让每次 PV 多 1 个请求额度（这笔账在[上一篇](/posts/workers-free-tier-cost/)里算过），所以我先留着。等你看到自己站点上每篇都是 0 次时，先别怀疑接口。

要抄的话，按这个顺序做：

1. 定一张两列的表（`pathname` 主键 + `views` 计数），别急着存 UA/IP——那些需求九成不会实现，真要实现也该换一套表。
2. 接口分三个：单读（`/share`）、批量读（`/batch`，请求体就用裸数组，**顺序即契约**）、写（`/send`，带 Origin 守卫并按需静默丢弃）。
3. 前端先渲染空壳（`display: none`），拿到数据再亮——不要先渲染 0 再跳数。
4. 一页上多个组件要读数时，用「队列 + 一次性取数」，并留一个能让位的开关（列表页排序脚本优先）。
5. 依赖下标的排序逻辑，一定要用非零的模拟数据测一遍，别拿线上的全 0 当"测过了"。
6. 失败路径要测全：500、空响应体、CORS 被拦，三种情况下页面都应该安静地不显示数字。
