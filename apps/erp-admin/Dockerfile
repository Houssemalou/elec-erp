# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/erp-admin/package.json apps/erp-admin/package.json
COPY apps/vitrine/package.json apps/vitrine/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/services/package.json packages/services/package.json
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/erp-admin/node_modules ./apps/erp-admin/node_modules
COPY --from=deps /app/apps/vitrine/node_modules ./apps/vitrine/node_modules
COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN npm run build -w apps/erp-admin

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/apps/erp-admin/.next/standalone ./
COPY --from=builder /app/apps/erp-admin/.next/static ./apps/erp-admin/.next/static
COPY --from=builder /app/apps/erp-admin/public ./apps/erp-admin/public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/packages/db/prisma ./prisma
COPY docker/entrypoint.sh ./entrypoint.sh
USER nextjs
EXPOSE 3001
ENTRYPOINT ["sh", "./entrypoint.sh"]