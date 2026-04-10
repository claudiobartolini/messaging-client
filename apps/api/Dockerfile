# ---- builder ----
FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @messaging/shared build
RUN pnpm --filter @messaging/api db:generate
RUN pnpm --filter @messaging/api build
# Bundle the API with its production deps into a standalone directory
RUN pnpm --filter @messaging/api deploy --prod --legacy /app/api-standalone
# Regenerate Prisma client inside the standalone so .prisma/client/ is present
WORKDIR /app/api-standalone
COPY apps/api/prisma prisma/
RUN node node_modules/prisma/build/index.js generate

# ---- runner ----
FROM node:22-alpine AS runner
# Prisma query engine requires openssl on Alpine
RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=builder /app/api-standalone .
# Migrations must be present for `prisma migrate deploy` in the Cloud Run Job
COPY --from=builder /app/apps/api/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main.js"]
