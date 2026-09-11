FROM node:24.19.0-bookworm-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN npm install -g pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json next-env.d.ts next.config.ts postcss.config.mjs ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY schemas ./schemas
COPY curation/profiles ./curation/profiles
COPY curation/sources/*.registry.json ./curation/sources/
COPY curation/approved-endpoints.json ./curation/approved-endpoints.json
RUN pnpm build

FROM node:24.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3400 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3400
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3400/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM build AS worker
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /logs && chown node:node /logs
USER node
CMD ["pnpm", "worker"]
