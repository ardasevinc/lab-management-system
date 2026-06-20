FROM oven/bun:1.3.13-alpine AS app

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN bun install --frozen-lockfile

RUN apk add --no-cache sqlite

COPY . .

RUN bun run build

ENV NODE_ENV=production
ENV PORT=3001
ENV SERVE_WEB=1
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV DATABASE_URL=file:/app/data/lab.sqlite

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD bun -e "const r = await fetch('http://127.0.0.1:' + (Bun.env.PORT ?? '3001') + '/health'); if (!r.ok) process.exit(1)"

CMD ["bun", "apps/api/src/index.ts"]
