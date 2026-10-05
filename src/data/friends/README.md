# 友链数据

每个友链一个 JSON 文件，文件名随意（建议用站点名）。字段：

```json
{
  "name": "站点名称",
  "avatar": "https://example.com/avatar.png",
  "url": "https://example.com",
  "description": "一句话简介",
  "backlink": "https://example.com/friends/"
}
```

- `avatar` / `url` / `name` 必填，`backlink` 用于双向链接校验（GitHub Action 会检查对方友链页是否包含本站链接）。
- 页面会自动读取本目录下的所有 `*.json`。
