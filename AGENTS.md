# Repository Guidelines

## Project Structure & Modules
- Monorepo managed with Turbo and Bun.
- Applications live in `apps/`:
  - `apps/web`: SolidJS + Vite web client.
  - `apps/server`: Bun + Elysia API server.
  - `apps/desktop`: Tauri desktop shell.
- Shared packages live in `packages/` (UI, code editor, fs, logger, eslint/ts configs).

## Build, Dev & Lint
- Install deps: `bun install` (Node ≥ 18, Bun as package manager).
- Run all apps in dev: `bun run dev`.
- Example focused dev run: `bun run dev --filter web` or `--filter server`.
- Build all: `bun run build`.
- Lint: `bun run lint` (uses `@repo/eslint-config`).
- Format: `bun run format` (Prettier for `ts`, `tsx`, `md`).
- Type-check: `bun run check-types`.

## Coding Style & Naming
- Languages: TypeScript/TSX for apps and packages.
- Indentation: tabs; keep existing single-quote, no-semicolon style.
- Components: `PascalCase` (e.g. `MainLayout.tsx`).
- Functions/variables: `camelCase`; files generally `PascalCase.tsx` for components, `camelCase.ts` for utilities.
- Always fix ESLint and formatting issues before opening a PR.

## Testing Guidelines
- No global test runner is enforced yet; prefer adding tests close to the code (`*.test.ts` / `*.test.tsx`).
- When introducing tests to a package, add a `test` script to that package and document how to run it in the README.
- Keep tests fast and deterministic; avoid hitting real external services.

## Commit & Pull Request Guidelines
- Commits: short, present-tense summaries, optionally scoped, e.g. `web: improve terminal resizing`.
- Group related changes; avoid large, mixed-topic commits.
- PRs should include:
  - A clear description of the change and motivation.
  - Notes on how you tested it (commands, browsers, platforms).
  - Screenshots or recordings for noticeable UI changes.
  - Mention of any breaking changes or migrations.

## Security & Configuration
- Do not commit secrets or `.env` files; `apps/server` loads env via `dotenv`.
- Document required env vars in an example file (e.g. `apps/server/.env.example`) when adding new configuration.
