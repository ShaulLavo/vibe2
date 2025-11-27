# Desktop shell

This package only wraps the web app with Tauri. The web UI lives in `apps/web`; this package just starts it (dev) or consumes its build output (packaging).

### Commands
- Dev: `bun run dev --filter=desktop` (or `turbo run dev --filter=desktop`)
- Build: `bun run build --filter=desktop` (or `turbo run build --filter=desktop`)
