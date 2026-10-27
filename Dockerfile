FROM oven/bun:1.4.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS development
COPY --chown=bun:bun . .
RUN mkdir -p .next && chown bun:bun /app /app/.next
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
USER bun
EXPOSE 3000
CMD ["bun", "scripts/start-container.ts"]

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1.4.4 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/.next ./.next
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/scripts ./scripts
COPY --from=builder --chown=bun:bun /app/src/shared/lib/env.ts ./src/shared/lib/env.ts
USER bun
EXPOSE 3000
CMD ["bun", "scripts/start-container.ts"]
