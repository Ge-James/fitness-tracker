# 健身追踪

一个移动端优先的 PWA，用于记录训练、身体数据趋势和身材照片。

## 本地预览

双击 `start-preview.bat`，然后在浏览器打开：

```text
http://127.0.0.1:5173/
```

## 部署

这个项目是纯静态网页，可以部署到 GitHub Pages、Vercel 或 Netlify。

## Supabase 云同步

1. 在 Supabase 创建项目。
2. 打开 Supabase SQL Editor，执行 `supabase-schema.sql`。
3. 在 Supabase Project Settings > API 里复制：
   - Project URL
   - anon public key
4. 填入 `supabase-config.js`。
5. 推送到 GitHub Pages。

`supabase-config.js` 里的 anon key 是前端公开 key，不是 service role secret。不要把 service role key 放进这个项目。

## ChatGPT 只读 MCP

`fitness-mcp/` 是一个独立的只读 MCP server，用来让 ChatGPT 读取 Supabase 里的训练、身体、睡眠/状态和照片数据。

它可以和本项目一起开源，但不要提交：

- `fitness-mcp/.env`
- Supabase `service_role` key
- `FITNESS_READ_TOKEN`

第一版使用私有 token 授权。ChatGPT 调用 MCP 时只需要 `FITNESS_READ_TOKEN`，真正的 Supabase `service_role` key 只放在 MCP server 的部署平台环境变量里。

更多说明见 `fitness-mcp/README.md`。
