# Fitness Tracker Read-only MCP

Read-only MCP server for ChatGPT/Codex access to the fitness tracker Supabase data.

## What It Exposes

- `get_recent_workouts`
- `get_workout_detail`
- `get_body_trends`
- `get_sleep_status`
- `list_progress_photos`
- `get_progress_photo_links`
- `get_fitness_overview`

All tools are read-only. They always filter by `FITNESS_USER_ID`.

## Local Setup

```powershell
cd "C:\Users\james\Documents\健身追踪\fitness-mcp"
npm install
Copy-Item .env.example .env
```

Fill `.env`:

- `SUPABASE_URL`: project URL, like `https://xxxx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key, never commit this
- `FITNESS_USER_ID`: your Supabase auth user id
- `FITNESS_READ_TOKEN`: long random token used by ChatGPT to call this MCP

Run:

```powershell
npm start
```

Health check:

```text
http://localhost:8787/health
```

MCP endpoint:

```text
http://localhost:8787/mcp
```

Requests must include:

```text
Authorization: Bearer YOUR_FITNESS_READ_TOKEN
```

## Deploy

This is a small Node server, not a static site. Deploy it somewhere that can run a long-lived Node HTTP server, for example Render, Railway, Fly.io, or a small VPS.

Do not deploy this MCP server to GitHub Pages. GitHub Pages can only host static files.

This repo includes a root `render.yaml` Blueprint. On Render, create a new Blueprint from the GitHub repo and Render will use `fitness-mcp` as the service root directory.

Use these environment variables in the hosting dashboard:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FITNESS_USER_ID`
- `FITNESS_READ_TOKEN`

After deployment, ChatGPT should connect to:

```text
https://your-mcp-host.example.com/mcp
```

with:

```text
Authorization: Bearer YOUR_FITNESS_READ_TOKEN
```

## Security Notes

- Do not put `.env` in GitHub.
- Do not give ChatGPT your Supabase service role key.
- Give ChatGPT only `FITNESS_READ_TOKEN`.
- Photo tools return short-lived Supabase signed URLs.
- Rotate `FITNESS_READ_TOKEN` if you think it leaked.
