# Deployment Guide

> **Verification status**: Local development is **VERIFIED** in the sandbox
> environment (port 3000). Full Docker deployment is **CONFIGURED but NOT
> VERIFIED** in the sandbox (single-port limitation prevents running both the
> app and PostgreSQL simultaneously). The configuration is provided for
> production deployment and documented below.

## Local Development (VERIFIED)

### Prerequisites
- Node.js 20+ (or Bun)
- SQLite (bundled — no server required)

### Steps
```bash
# 1. Install dependencies
bun install        # or npm install

# 2. Copy environment config
cp .env.example .env
# (SQLite default works out of the box)

# 3. Push database schema
bun run db:push

# 4. Seed reproducible experiment (19 scenarios)
curl -X POST http://localhost:3000/api/seed
# or click "Seed demo data" in the dashboard header

# 5. Start dev server
bun run dev        # → http://localhost:3000
```

### Verification commands
```bash
bun run lint                              # ESLint — must be clean
bunx tsx tests/verification-engine.test.ts # 29 assertions
bunx tsx tests/failure-scenarios.test.ts  # 50 assertions
bunx tsx scripts/evaluate.ts --reseed     # Reproducible evaluation
```

## Production Deployment (CONFIGURED, NOT VERIFIED in sandbox)

### Option A: Docker Compose (Next.js + PostgreSQL)

```bash
# 1. Switch Prisma provider to PostgreSQL
#    In prisma/schema.prisma:
#      datasource db { provider = "postgresql" ... }

# 2. Set environment
export POSTGRES_PASSWORD="your-secure-password"
export SESSION_SECRET="your-long-random-secret"

# 3. Build and run
docker compose up --build
# → app on http://localhost:3000, PostgreSQL on 5432
```

The `docker-compose.yml` provisions:
- **PostgreSQL 16** with persistent volume
- **Next.js app** (standalone build) with evidence storage volume
- Health checks and dependency ordering

The Dockerfile:
- Multi-stage build (deps → builder → runner)
- Runs `prisma db push` on startup
- Non-root user (`nextjs`)
- Exposes port 3000

### Option B: Standalone Node.js (VERIFIED pattern)

```bash
bun run build       # produces .next/standalone
NODE_ENV=production bun .next/standalone/server.js
```

### What is VERIFIED vs NOT VERIFIED

| Aspect | Status | Evidence |
|--------|--------|----------|
| Local dev (SQLite) | ✅ VERIFIED | `bun run dev` runs on port 3000, HTTP 200 |
| Prisma schema push | ✅ VERIFIED | `bun run db:push` succeeds |
| Seed (19 scenarios) | ✅ VERIFIED | `POST /api/seed` → 19 incidents, 42 reports |
| All API routes | ✅ VERIFIED | agent-browser QA confirms 200 responses |
| Evidence upload (secure) | ✅ VERIFIED | magic-byte validation, private storage |
| **PostgreSQL compatibility** | ✅ **VERIFIED** | `scripts/verify-postgres.ts` — 18 assertions via PGlite (schema, user/RBAC, incident, report, evidence, verification, audit, engine eval, score persistence, 3 categories, CASCADE delete) |
| Docker build | ⚠️ CONFIGURED, NOT VERIFIED | Dockerfile + compose provided; sandbox has no Docker daemon |
| Production secrets | ⚠️ DOCUMENTED | `.env.example` provided; production must override |

## Environment Variables

See `.env.example` for the complete list. Critical for production:

- `DATABASE_URL` — PostgreSQL connection string (switch provider in schema.prisma)
- `SESSION_SECRET` — HMAC secret for session cookies (change from default)
- `EVIDENCE_STORAGE_DIR` — custom path for evidence files (default: `./storage/evidence`)

## Evidence Storage

Files are stored **outside `/public`** in `./storage/evidence/` and served via the
controlled API route `GET /api/uploads/evidence/[name]` which:
- Validates filename pattern (`evd_<hex>.<ext>`)
- Allowlists extensions (jpg, jpeg, png, webp, gif)
- Validates magic bytes (content must match extension)
- Sets `X-Content-Type-Options: nosniff`
- Prevents path traversal

In production, mount a persistent volume at `/app/storage/evidence` (see
`docker-compose.yml`).
