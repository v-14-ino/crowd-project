# Municipal Crowd-Report Verification & Confidence Dashboard
# Multi-stage Dockerfile for Next.js 16 standalone production build.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json bun.lock* ./
# Install with npm (fallback) since bun may not be available in the image
RUN npm install --frozen-lockfile || npm install

# --- Builder ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client
RUN npx prisma generate
# Build Next.js (standalone output)
RUN npm run build

# --- Runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Prisma client + schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
# Create storage dir for evidence uploads
RUN mkdir -p /app/storage/evidence && chown -R nextjs:nodejs /app/storage
# .env is provided at runtime via docker-compose or -e flags
COPY --from=builder /app/.env.example ./.env.example

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run migrations on startup then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
