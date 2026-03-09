# Dockerfile for SwarmMind API
# Frontend (apps/web) is deployed on Vercel
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install dependencies (--ignore-scripts to skip postinstall prisma generate from apps/web)
RUN npm ci --ignore-scripts

# Build the API
FROM base AS api-builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN npm run build --workspace=@swarm/api

# Production API image
FROM base AS api-runner
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

ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3001/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "dist/index.js"]
