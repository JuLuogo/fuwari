---
title: SSL Labs 给我博客打了个 B：HTTPS 配置到底被扣在哪
published: 2026-10-05 21:50:00 +08:00
description: 用 SSL Labs 给 blog.juluo.work 做真实体检：四个边缘节点全部评 B，唯一扣分项是服务端仍接受 TLS 1.0/1.1。本文记录评分怎么读、怎么用 openssl 在本机复现结论，以及逐项判断哪些扣分值得修。
tags:
  - HTTPS
  - 安全
  - Cloudflare
pinned: false
draft: false
---

「你的 HTTPS 配置能打几分？」——以前我对这个问题的回答是「Cloudflare 托管的，能有什么问题」。直到把域名丢进 SSL Labs，四个边缘节点整整齐齐，全是 **B**。

> [!NOTE]
> 站点环境：Astro 静态站，Cloudflare Worker `peroe-blog`（静态资源模式），免费套餐，域名 `blog.juluo.work`。本文所有评分、协议版本、证书信息都是 **2026-10-05 晚本机实测**：SSL Labs 报告时间 `Mon, 05 Oct 2026 13:17:03 UTC`，引擎版本 `2.4.3`，评级规则版本 `2009q`。

## 先说清楚 SSL Labs 在测什么

搞清楚工具的边界，比拿到分数重要。

SSL Labs 只做一件事：模拟几十种客户端去跟你的服务器握手，然后根据「你支持哪些协议版本、哪些密码套件、证书链可不可信、有没有已知漏洞」打分。它测的是**传输层**。

它**不看**这些东西：

- HSTS 有没有开（只影响你能不能从 A 爬到 A+）
- 明文 HTTP 会不会跳转 HTTPS
- `Content-Security-Policy`、`X-Frame-Options`、`Referrer-Policy` 这些响应头
- Cookie 的 `Secure` / `HttpOnly` 属性、页面里的混合内容

所以 B 不等于不安全，A+ 也不等于安全。我这个站的安全响应头体检是 **F**（写在[另一篇](/posts/security-headers-audit/)里），跟这份 B 分说的是两件完全不同的事。两份报告放在一起看才有意义。

不过有一点是可以先下判断的：对个人博客来说，TLS 这一层基本是**白送**的——证书是 Cloudflare 的 Universal SSL 自动签发续期，协议栈是 Cloudflare 的，我一行配置都没写过。既然我这边成本为零，那分数低就只可能是某个开关没拨。

## 第一步：让 SSL Labs 跑一遍

直接怼 URL：<https://www.ssllabs.com/ssltest/analyze.html?d=blog.juluo.work>。

几个实测出来的细节：

- **有缓存。** 同一个域名 24 小时内的结果会直接从缓存给你，页面顶部会写 `Assessed on` 的时间。所以第一次跑完要等，后面再打开就是秒出。
- **慢。** 报告里每个节点的 `Duration` 分别是 `104.78 / 103.948 / 104.164 / 104.147 sec`，也就是单节点 100 秒出头。
- **节点是 4 个。** 两个 IPv4（`172.67.135.130`、`104.21.6.247`）加两个 IPv6（`2606:4700:3033:0:0:0:6815:6f7`、`2606:4700:3035:0:0:0:ac43:8782`），串行扫完 5 分钟以上。

结果是这样：

![SSL Labs 对 blog.juluo.work 的报告首页，四个边缘节点（两个 IPv4、两个 IPv6）评级全部是 B](/assets/images/posts/ssllabs-https-grade/01-ssllabs-grade-b.webp)

网页版的柱状图只能目测，想要结构化数据可以直接打它的公开 API——不需要注册，也不需要 key：

```bash
curl -s "https://api.ssllabs.com/api/v3/analyze?host=blog.juluo.work&all=done" \
  | jq '.endpoints[] | {ip: .ipAddress, grade: .grade}'
```

返回里三个关键字段：`grade = B`、`gradeTrustIgnored = B`、`hasWarnings = false`。最后一个说明它不是靠「有警告」压下来的，是硬扣。

## 第二步：点开端点详情，看它到底扣在哪

报告首页只给结论，点进任意一个 IP 才是明细。

![SSL Labs 端点详情的 Summary 区块：Overall Rating 是 B，四根柱子里 Protocol Support 明显最短，黄色横幅写着这台服务器支持 TLS 1.0 和 TLS 1.1、评级被压到 B](/assets/images/posts/ssllabs-https-grade/02-ssllabs-summary-cap.webp)

Summary 那一栏用四条横幅把话讲得很直白：

| 横幅 | 颜色 | 含义 |
| --- | --- | --- |
| This server supports TLS 1.0 and TLS 1.1. Grade capped to B. | 黄 | 唯一的扣分项：老协议还开着，直接封顶 B |
| This site works only in browsers with SNI support. | 蓝 | 提示信息，不扣分 |
| This server supports TLS 1.3. | 绿 | 加分项 |
| This server supports PQC (Post-Quantum Cryptography) key exchange. | 绿 | 加分项 |

再看它上面那四根柱子（Certificate / Protocol Support / Key Exchange / Cipher Strength）：Certificate 是满格，Key Exchange 和 Cipher Strength 目测都在九成上下，**只有 Protocol Support 明显凹下去一截**。柱子图形状和黄条说的完全一致——A 掉到 B，中间没有第二个原因。

## 第三步：用 openssl 在本机复现一遍

第三方报告的结论我不太愿意直接抄，得能自己复现。Windows 上 Git for Windows 自带 openssl（`C:\Program Files\Git\usr\bin\openssl.exe`，我这儿是 3.5.5）。

![在本机 PowerShell 里用 openssl s_client 实测：正常握手协商到 TLSv1.3 + TLS_AES_256_GCM_SHA384 + X25519MLKEM768；显式指定 -tls1_1 时服务端同样完成了握手](/assets/images/posts/ssllabs-https-grade/03-openssl-sclient.webp)

```bash
# 1. 正常握手：看协商到哪个版本、哪个套件
openssl s_client -connect blog.juluo.work:443 -servername blog.juluo.work -brief

# 2. 指定老协议：看服务端拒不拒（SECLEVEL 的坑见后文）
openssl s_client -connect blog.juluo.work:443 -servername blog.juluo.work \
  -tls1_1 -cipher 'DEFAULT@SECLEVEL=0' -brief

# 3. 看证书本身
openssl s_client -connect blog.juluo.work:443 -servername blog.juluo.work 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer -ext subjectAltName
```

实测结果：

- **正常握手**：`Protocol version: TLSv1.3`、`Ciphersuite: TLS_AES_256_GCM_SHA384`、`Negotiated TLS1.3 group: X25519MLKEM768`、`Verification: OK`。另外单独用 `-alpn h2,http/1.1` 测，ALPN 协商出来的结果是 `h2`。
- **指定 `-tls1_1`：握手成功**。`Protocol version: TLSv1.1`、`Ciphersuite: ECDHE-RSA-AES128-SHA`、`Signature type: rsa_pkcs1_md5_sha1`。指定 `-tls1` 同样能握上。作为对照，`-tls1_2` 走的是 `ECDHE-ECDSA-CHACHA20-POLY1305`。
- **证书**：`subject=CN=juluo.work`、`issuer=C=US, O=Google Trust Services, CN=WE1`，有效期 `Oct 5 08:44:00 2026 GMT` → `Jan 3 09:43:41 2027 GMT`，SAN 覆盖 `juluo.work`、`blog.juluo.work`、`*.blog.juluo.work`。

两条一对比，SSL Labs 的结论就落地了：**新协议没问题，是老协议没关。**

顺手再用 Cloudflare 文档里给的命令对照一次（这条测的是「有没有被拦住」）：

```bash
curl https://blog.juluo.work -svo /dev/null --tls-max 1.1
```

文档说如果被 Cloudflare 拦下，会报 `error:1400442E:SSL routines:CONNECT_CR_SRVR_HELLO:tlsv1 alert`。我这儿返回的是 `HTTP/1.1 200 OK`——没拦。

## 逐项过一遍：哪些分值得修

### 1. TLS 1.0 / 1.1 还开着 —— 唯一的真扣分，值得修

**为什么它扣分。** TLS 1.0（1999 年）和 1.1（2006 年）的 CBC 模式有 BEAST、Lucky13 这一类问题，而且不支持现代 AEAD 套件。SSL Labs 的规则很干脆：只要服务端还接受这两个版本，总分封顶 B，其它项再漂亮也没用。API 里还能看到 `vulnBeast: true`——它其实是「TLS 1.0 开着」的副产品，不是第二个独立问题。

**关掉的代价是什么。** 会连不上的是不支持 TLS 1.2 的客户端。2026 年这类客户端基本只剩：Android 5.0 以前的老系统浏览器（对 TLS 1.2 的支持不完整）、Windows XP 和没打过补丁的 Windows 7 上的老 IE、一些工业与嵌入式设备。对一个技术博客的读者群体来说，这个比例约等于零。

**怎么改。** Cloudflare 面板 → SSL/TLS → Edge Certificates → Minimum TLS Version，选 TLS 1.2。文档里的 Availability 表写得很清楚，**免费套餐就能用**，不需要 Advanced Certificate Manager。

![Cloudflare 文档 Minimum TLS Version 页面，Availability 表显示 Free 套餐即可使用，并给出「How to disable TLS 1.0」的步骤](/assets/images/posts/ssllabs-https-grade/04-cloudflare-minimum-tls.webp)

也可以用 API 一次改掉：

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/min_tls_version" \
  --request PATCH \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"id": "min_tls_version", "value": "1.2"}'
```

> [!WARNING]
> 诚实交代两句：**第一，我没有真的去拨这个开关**，因为改的是线上 zone 的配置，我不想在写文章的过程中动生产环境。所以「改完就是 A」是按 SSL Labs 的封顶规则推的，不是我实测出来的，别当成已验证结论。**第二，我也解释不了这个 zone 的最低版本为什么是 1.0**——面板里看不到这个设置的历史，我只能确认现状是服务端接受 TLS 1.0/1.1，别看到自己的站也这样就以为配置被人动过。

**我的判断：修。** 不是因为「TLS 1.0 很危险」——浏览器早就不用它了，真实风险很低——而是因为这是一个开关、十秒钟、零可感知代价的事。

### 2. 「This site works only in browsers with SNI support」—— 不用管

说的是服务端强制要求 SNI。没有 SNI 的客户端（Windows XP 上的 IE6、老 Java 之类）拿不到证书。这是 Cloudflare 的固定行为，免费套餐也改不了，而那些客户端本来就该淘汰了。

### 3. OCSP Stapling: No —— 报告里列了，但没有扣分

端点详情里 `OCSP Stapling` 是 `No`，`DNS CAA` 是 `No (more info)`。我特意回头核对了一遍：**评级横幅里没有任何一条提到它们，柱状图里也没有对应的扣分条。** 这两项是列给你看的信息，不是扣分点，不值得为了分数去折腾。

CAA 那条更跟 TLS 握手无关——它管的是「授权哪些 CA 能给 `juluo.work` 签证书」，属于证书治理，不是配置错误。

### 4. 密钥交换和套件强度已经很好了，别乱动

从 API 拿到的结构化数据：

- `namedGroups` 的第一项是 `X25519MLKEM768`，`namedGroupType` 标着 `PQC`——抗量子的混合密钥交换，免费套餐默认就开。
- `forwardSecrecy: 2`，现代套件全部支持前向保密。
- `supportsRC4: null`，RC4 没开；`compressionMethods: 0`，没有 CRIME 风险。
- `zeroRTTEnabled: 0`，0-RTT 是关的（0-RTT 有重放风险，关着是好事）。

**结论：这四项别碰。** 看到「可自定义密码套件」就手痒去关掉一堆，是典型的负收益操作——Cloudflare 的默认套件列表比大多数人手写的都更合理。

## 那些 SSL Labs 根本不看的东西

这一节大概是全文最该记住的部分。

前面提过它只测传输层，具体到我这个站：

- **HSTS 没开。** API 里 `hstsPolicy.status` 是 `absent`，`curl -D -` 拉下来的响应头里也确实没有 `Strict-Transport-Security`。但这事跟 B 分毫无关系，它只在你已经拿到 A 之后决定你能不能到 A+。
- **明文 HTTP 不跳转。** 实测 `http://blog.juluo.work/` 直接返回 `200 OK`，没有任何 301。SSL Labs 不管这个，因为它是个纯 HTTPS 扫描器。但从「防降级攻击」的角度看，这一条比 TLS 1.0 值钱得多。
- **安全响应头一个都没有。** CSP、X-Frame-Options、Referrer-Policy 全是缺的，那是另一份体检报告的 F 分，跟 TLS 两码事。

所以「冲 SSL Labs A+」这个目标本身就要打个问号：它只覆盖了 HTTPS 配置里的一条线。

## 普通博客值不值得折腾 A+

我的判断分三档：

1. **B → A（关掉 TLS 1.0/1.1）：值得，可以立刻做。** 一个开关、零代价。哪怕不为分数，少支持两个 1999 / 2006 年的协议也没有坏处。
2. **A → A+（加 HSTS）：可以做，但要先理解代价。** A+ 的条件是在 A 的基础上开 HSTS 且 `max-age` 足够长。HSTS 的真实风险不是「被攻击」，而是**你自己被锁在门外**：浏览器把策略缓存了，万一证书链出问题（Universal SSL 续期失败、你临时换成自签证书测试），访问者看到的是一个跳不过去的错误页。所以我建议的顺序还是「先开 Always Use HTTPS → 加短 `max-age` 的 HSTS 观察 → 稳定后再逐步爬坡」，`preload` 不用碰，展开写在[那篇响应头的文章](/posts/security-headers-audit/)里。
3. **为了 A+ 去手改密码套件、折腾 OCSP、加一堆用不上的东西：不值。** 分数上去了，实际风险没变，却很容易搞出「某些客户端连不上」这种只有自己不知道的故障。

一句话：**TLS 分数低，通常不是配置差，而是某个默认开关没拨。** 花十分钟把 B 修成 A 是划算的；为了从 A 爬 A+ 反复折腾，对一个个人博客来说就是自娱自乐了。

## 踩坑与注意事项

- **坑 1（差点被误导）：OpenSSL 3.x 默认 `SECLEVEL=1`，直接测 TLS 1.1 会得到「假阴性」。** 我第一次跑 `openssl s_client -tls1_1` 拿到的是 `no protocols available`，看起来就像「服务端拒绝了老协议」。其实那是**客户端自己**不肯用——OpenSSL 3.x 把 TLS 1.2 以下的协议划归过低的 `SECLEVEL`。必须显式降级才行：`-cipher 'DEFAULT@SECLEVEL=0'`。不加这个参数，我会得出「我的站最低已经是 TLS 1.2」的错误结论，然后跟 SSL Labs 的 B 分对不上，再去怀疑 SSL Labs 报错了。**看到工具报错，先确认报错的是哪一方。**
- **坑 2：SSL Labs 的网页对自动化很不友好。** `analyze.html` 会不停自我导航（URL 后面反复挂 `&latest`）去轮询进度，用一个固定选择器等结果很可能永远等不到——我按 `#rating_grade` 等了整整 5 分钟也没出现。要结构化数据就直接用 API；要截图就等缓存落定后再重新打开一次页面，第二次是读缓存，秒出。
- **坑 3：同一个域名会返回两张证书，别以为数据对不上。** Cloudflare 同时部署了 RSA（`WR1`）和 ECDSA（`WE1`）两张证书，服务端按客户端能力挑一张。所以 `openssl` 协商到的是 `WE1`（ECDSA P-256），而 SSL Labs 报告里排第一的是 RSA 2048 的 `WR1`，两张的 `notAfter` 还差了几分钟（`09:43:41` 对 `09:40:49`）。谁都没错。
- **坑 4：PowerShell 里调 openssl，`2>&1` 之后拿到的不是字符串。** `openssl s_client` 把 `Connecting to ...` 写在 stderr 上，我用 `2>&1` 合并后直接 `Out-File`，PowerShell 顺手把 `NativeCommandError` 的整块报错（`所在位置 行:4 字符:15` 那一坨）也写进了文件，第一版终端配图直接报废。要么走 `cmd /c "... < NUL 2>&1"`，要么在管道里显式 `"$_"` 转成字符串。
- **坑 5：Worker 静态资源模式的站，「SSL/TLS 加密模式」是个伪命题。** 几乎每篇教程都让你把加密模式设成 `Full (strict)`。但这一项管的是 **Cloudflare → 源站** 那一段：`Flexible` 是回源走明文，`Full` 是不校验证书，`Full (strict)` 才校验。我的博客是 Worker 静态资源模式，资源就在 Cloudflare 边缘，**根本不存在「源站」这一段**，所以 Off / Flexible / Full / Full (strict) 选哪个，对我的站不产生任何实际影响。

![Cloudflare 文档 Encryption modes 页面，Off / Flexible / Full / Full (strict) 四种模式描述的都是 Cloudflare 与源站之间的那段连接](/assets/images/posts/ssllabs-https-grade/05-cloudflare-encryption-modes.webp)

## 小结

- **实测结论**：SSL Labs 对 `blog.juluo.work` 的四个边缘节点全部评 **B**，唯一扣分项是服务端仍接受 **TLS 1.0 和 TLS 1.1**，评级被 capped to B。
- **其余项都是好的**：TLS 1.3 + AEAD 套件（`TLS_AES_256_GCM_SHA384`）、抗量子混合密钥交换（`X25519MLKEM768`）、前向保密、证书链受信（Google Trust Services，SAN 覆盖 `blog.juluo.work` 与 `*.blog.juluo.work`）——这些 Cloudflare 免费套餐默认就给。
- **值得修的只有一个**：Minimum TLS Version 改成 1.2，免费套餐可用，代价接近零。
- **不值得修的**：OCSP Stapling、CAA、SNI 提示——要么不影响评级，要么跟 TLS 体检本身无关；更不要为了分数去手改密码套件列表。
- **别忘了 SSL Labs 覆盖不到的地方**：HSTS、明文 HTTP 强制跳转、安全响应头，它一样都不测，而这几项对真实安全的影响不比 TLS 版本小。
