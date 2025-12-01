# Repository Guidelines

## Project Structure & Modules
- App entrypoints live in `src/App.tsx` and `src/index.tsx`.
- Shared UI, terminal, and FS logic is under `src/components`, `src/terminal`, and `src/fs`.
- Cross-cutting utilities and types reside in `src/utils` and `src/types`.
- Global styles are defined in `src/styles.css` and `tailwind.config.ts`.

## Build, Test, and Development
- `npm run dev` / `npm start`: start Vite dev server on port 3000.
- `npm run build`: production build to `dist/`.
- `npm run serve`: preview the built app from `dist/`.
- `npm run lint`: run ESLint using `@repo/eslint-config/solid` (no warnings allowed).
- No test runner is configured in this app; add one per feature if needed.

## Coding Style & Naming
- Use TypeScript and SolidJS with functional components (`PascalCase` filenames, e.g. `EditorPane.tsx`).
- Prefer named exports; avoid default exports for components and utilities.
- Keep modules focused; colocate feature-specific code under `src/fs`, `src/terminal`, or `src/components/fs`.
- Follow the shared ESLint config; fix all reported issues before committing.

## Testing Guidelines
- When adding tests, prefer Vitest colocated next to source files (e.g. `ComponentName.test.tsx`).
- Write tests for new business logic in `src/fs`, `src/utils`, and `src/terminal`.
- Aim for meaningful coverage of critical flows (FS operations, terminal interactions) rather than raw percentages.

## Commit & Pull Requests
- Use clear, imperative commit messages (e.g. `Add FS context provider`, `Fix terminal resize bug`).
- Keep changesets focused and small; separate refactors from behavioral changes when possible.
- For PRs, include: purpose, high-level changes, any breaking behavior, and screenshots or recordings for UI-impacting work.
- Link related issues or tasks and mention any follow-ups (tech debt, TODOs).

