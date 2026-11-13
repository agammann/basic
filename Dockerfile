FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS build
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
RUN DATABASE_URL=postgresql://build.invalid/unused pnpm build

FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3400 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3400
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3400/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "test -n \"$DATABASE_URL\" || { echo 'DATABASE_URL is required' >&2; exit 1; }; exec node server.js"]

FROM build AS worker
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /logs && chown node:node /logs
USER node
CMD ["sh", "-c", "test -n \"$DATABASE_URL\" || { echo 'DATABASE_URL is required' >&2; exit 1; }; exec pnpm worker"]
