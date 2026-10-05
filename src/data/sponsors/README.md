# 赞助记录

每个赞助者一个 JSON 文件，字段：

```json
{
  "name": "赞助者名称",
  "avatar": "https://example.com/avatar.png",
  "date": "2026-01-01",
  "amount": "¥ 20"
}
```

`name` / `date` / `amount` 必填。页面会自动读取本目录下的所有 `*.json`。

收款码图片放在 `public/sponsors/`（当前是占位图，替换 `alipay.svg` 与 `wechat.svg` 即可）。
