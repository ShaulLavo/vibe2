# Vibe Server - Elysia/Bun
FROM oven/bun:1.2.22-alpine

WORKDIR /app

# Copy server package files
COPY apps/server/package.json ./
COPY apps/server/bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy server source
COPY apps/server/src ./src

# Create cache directory for fonts
RUN mkdir -p .cache

EXPOSE 3001

ENV VITE_SERVER_PORT=3001

CMD ["bun", "run", "src/index.ts"]
