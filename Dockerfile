# Dockerfile for SwarmMind API
# Frontend (apps/web) is deployed on Vercel
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

RUN npm ci --ignore-scripts
# Rebuild bcrypt native bindings (skipped by --ignore-scripts)
RUN cd node_modules/bcrypt && npx node-pre-gyp install --fallback-to-build

# Build the API
FROM base AS api-builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build
RUN cd apps/api && npx prisma generate
RUN npm run build --workspace=@swarm/api

# Production image
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=api-builder /app/apps/api/dist ./dist
COPY --from=api-builder /app/apps/api/package.json ./package.json
COPY --from=api-builder /app/apps/api/prisma ./prisma
COPY --from=api-builder /app/node_modules ./node_modules

USER apiuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
