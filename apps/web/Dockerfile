# Vibe Web - Multi-stage build
# Stage 1: Build
FROM oven/bun:1.2.22 AS builder

# Install git (needed for icons build to fetch icon packs)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files
COPY package.json bun.lock* ./
COPY turbo.json ./

# Copy all workspace packages (needed for monorepo build)
COPY packages ./packages
COPY apps ./apps

# Install all dependencies (skip postinstall to avoid tree-sitter path issues)
RUN bun install --ignore-scripts

# Run tree-sitter asset copy manually (handles hoisted node_modules)
RUN bun run --cwd apps/web copy-tree-sitter-assets

# Build submodules first (icons, sqlite-wasm, just-bash)
# Clean up icons cache after build to save disk space (icons source repos are large)
RUN bun run build:submodules && rm -rf packages/icons/.cache

# Build the web app - use custom build script for detailed error reporting
RUN cd apps/web && bun scripts/build.mjs

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom nginx config with COOP/COEP headers for SharedArrayBuffer (SQLite OPFS)
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
