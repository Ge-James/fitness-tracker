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
