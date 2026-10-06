# 赞助记录

`/sponsors/` 页面下半部分的「赞助者」列表，会自动读取本目录下的所有 `*.json` ——
**一个赞助者一个文件，不需要改任何代码**。

## ⚠️ 文件规则（这三条都是踩过的坑，务必先看）

1. **后缀必须是小写的 `.json`**
   写成 `.JSON`、`.Json`、`.json5`、`.json.txt` 都**不会被读取**。
   构建机是 Linux，**文件名大小写敏感**（Windows 上看着像没问题，线上一定不显示）。
   👉 真实案例：`juluo.JSON` 加了但页面一直不显示，就是这一条。
2. **一个文件一个赞助者**，文件名随便取（只用来让你自己辨认），推荐英文或拼音、
   不要用空格和中文，例如 `juluo.json`、`zhangsan-2026.json`。
3. **必须是合法 JSON**：不能写注释、不能有多余的逗号、字符串必须用**双引号**（中文引号「」都不行）。

## 字段说明

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `name` | ✅ | 字符串 | 赞助者显示名称 |
| `date` | ✅ | 字符串 | 日期，建议 `YYYY-MM-DD` |
| `amount` | ✅ | 字符串 | 金额，例如 `"¥ 200"`（`¥` 后面带个空格更好看） |
| `avatar` | 可选 | 字符串 / `null` | 头像图片 URL；没有就写 `null`，或者**整个字段省略**（页面会显示名称首字） |

## 模板（复制过去改改就行）

```json
{
  "name": "juluo",
  "avatar": "https://q2.qlogo.cn/headimg_dl?dst_uin=1576586736&spec=0",
  "date": "2026-10-01",
  "amount": "¥ 200"
}
```

## 加完之后怎么上线

```powershell
# 在仓库根目录
git add src/data/sponsors/你的文件名.json
git commit -m "sponsors: 添加赞助记录 XXX"
git push origin main
```

推送后 Cloudflare 会自动构建，**约 2~4 分钟**后 <https://blog.peroe.cn/sponsors/> 就能看到。
想本地先确认：`pnpm astro build && pnpm preview`，然后打开 `/sponsors/`。

> 在 GitHub 网页上直接建文件也可以，但**文件名一定要手打小写 `.json`**（网页不会自动帮你改大小写）。

## 页面没显示？按这个顺序排查

| 现象 | 原因 / 处理 |
| --- | --- |
| 列表还是「还没有赞助记录」 | ① **后缀不是小写 `.json`**（最常见）；② 文件放错目录（必须是 `src/data/sponsors/`）；③ 改完**没提交推送**（本地改了不 push，线上不会变） |
| 构建日志出现 `[sponsors] src/data/sponsors 下这些文件不会被读取：xxx` | 就是第 ① 条 —— 构建时已加了告警，按提示改名成小写 `.json` 即可 |
| 某个字段不显示 | 字段名拼错（**区分大小写**，必须是 `name`/`date`/`amount`/`avatar`）；`avatar` 为 `null` 时只显示名称首字 |
| 整站构建失败 | JSON 语法错误（多余逗号、注释、中文引号）—— 本地跑 `pnpm astro build` 会直接报错并指出文件 |

## 相关但不在这里的东西

- **收款码图片**放 `public/sponsors/`（`alipay.svg` / `wechat.svg`），和本目录的赞助记录是两回事。
- 赞助页正文文案在 `src/pages/sponsors.astro`；导航入口在 `src/config.ts` 的 `navBarConfig`。
