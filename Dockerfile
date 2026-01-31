# Multi-stage Dockerfile for SWARM Board
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN npm ci

# Build the API
FROM base AS api-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN npm run build --workspace=@swarm/api

# Build the web app
FROM base AS web-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build web
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build --workspace=@swarm/web

# Production API image
FROM base AS api-runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=api-builder /app/apps/api/dist ./dist
COPY --from=api-builder /app/apps/api/package.json ./package.json
COPY --from=api-builder /app/apps/api/node_modules ./node_modules
COPY --from=api-builder /app/apps/api/prisma ./prisma

USER apiuser

EXPOSE 3001

ENV PORT 3001

CMD ["node", "dist/index.js"]

# Production web image
FROM base AS web-runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=web-builder /app/apps/web/public ./public
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
