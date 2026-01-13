# Coolify Deployment Instructions

This app has 2 services:
1. **Web** - Static SPA (SolidJS) served by nginx
2. **Server** - Bun/Elysia API (font proxy, git proxy)

---

## Prerequisites

- Coolify installed and running
- Git repo accessible (GitHub/GitLab with deploy key or public)
- Domain names ready (e.g., `vibe.example.com` and `api.vibe.example.com`)

---

## Step 1: Add the Git Repository

1. Go to **Coolify Dashboard** → **Projects** → **+ Add**
2. Create a new project (e.g., "Vibe")
3. Click **+ New Resource** → **Public Repository** (or Private if needed)
4. Enter the repo URL
5. If private: Add deploy key to your GitHub/GitLab repo

---

## Step 2: Deploy the Server (API)

1. In your project, click **+ New Resource** → **Docker**
2. Select **Dockerfile** as build method
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `vibe-server` |
| **Dockerfile Location** | `apps/server/Dockerfile` |
| **Build Context** | `.` (root of repo) |
| **Port** | `3001` |

4. **Environment Variables** (add these):
```
VITE_SERVER_PORT=3001
VITE_WEB_PORT=80
VITE_WEB_ORIGIN=https://vibe.example.com
WEB_ORIGIN=https://vibe.example.com
GIT_PROXY_ALLOWED_HOSTS=github.com
```

5. **Domain**: Set to `api.vibe.example.com` (or your API subdomain)

6. **Persistent Storage** (optional but recommended):
   - Add volume: `/app/.cache` → for font caching

7. Click **Deploy**

---

## Step 3: Deploy the Web App (SPA)

1. In your project, click **+ New Resource** → **Docker**
2. Select **Dockerfile** as build method
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `vibe-web` |
| **Dockerfile Location** | `apps/web/Dockerfile` |
| **Build Context** | `.` (root of repo) |
| **Port** | `80` |

4. **Environment Variables** (build-time):
```
VITE_SERVER_URL=https://api.vibe.example.com
```

5. **Domain**: Set to `vibe.example.com`

6. Click **Deploy**

---

## Step 4: Verify

1. Visit `https://vibe.example.com` - should load the SPA
2. Check browser console - no CORS errors to API
3. Visit `https://api.vibe.example.com/swagger` - should show API docs

---

## Troubleshooting

### Build fails on submodules
The web Dockerfile runs `bun run build:submodules` which builds:
- `packages/icons`
- `packages/sqlite-wasm`
- `packages/just-bash`

If this fails, check that all submodules are cloned. You may need to:
```bash
git submodule update --init --recursive
```

### CORS errors
Make sure `VITE_WEB_ORIGIN` on the server matches your web app's domain exactly (including `https://`).

### Font caching not working
Add a persistent volume to the server at `/app/.cache`.

### Service worker issues
Ensure the web app is served over HTTPS (Coolify handles this with Let's Encrypt).

---

## Architecture

```
                    ┌─────────────────────────────┐
   User Browser ───▶│  vibe.example.com (nginx)   │
                    │  Static SPA - Port 80       │
                    └─────────────────────────────┘
                                 │
                                 │ API calls
                                 ▼
                    ┌─────────────────────────────┐
                    │ api.vibe.example.com (Bun)  │
                    │ Elysia Server - Port 3001   │
                    │ - /fonts (Nerd Fonts proxy) │
                    │ - /git/proxy (CORS proxy)   │
                    └─────────────────────────────┘
```

---

## Auto-Deploy (Optional)

In Coolify, enable **Webhooks** for both services:
1. Go to each service → **Webhooks**
2. Copy the webhook URL
3. Add to GitHub/GitLab as a push webhook
4. Now pushes to main will auto-deploy
