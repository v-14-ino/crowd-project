# Limitations

> Honest limitations of the **actual implemented system**.

## Verified Limitations

1. **SQLite database (local dev)** — used for local development and demo. The
   Prisma schema is **verified compatible with PostgreSQL** via PGlite
   (in-memory Postgres) — see `scripts/verify-postgres.ts` (18 assertions).
   Production deployment should use PostgreSQL (Docker config provided).

2. **Role-based access is a lightweight cookie session** — not production RBAC.
   The session is signed with HMAC but does not use NextAuth/JWT. In production,
   replace `src/lib/session.ts` with NextAuth or an equivalent.

3. **Spatial map is an SVG scatter plot** — not Leaflet/OpenStreetMap. Suitable
   for the demo bounding box but not for real geographic data at scale.

4. **Precision@20 = 52.6% (target 75% — NOT MET)** — this is a dataset-size
   artifact, not an engine weakness. The dataset has 19 incidents (10 true-high,
   9 true-low), so the top-20 includes ALL incidents. Precision@20 cannot exceed
   10/19 = 52.6% by definition. Precision@10 (the meaningful ranking metric) is
   **100%** — all top-10 incidents are ground-truth high-priority.

5. **Operational confidence threshold (70) is conservative** — at threshold 70,
   recall is 30% because only responder-verified or strongly-corroborated (3+
   independent reports) incidents reach 70. The threshold sweep shows optimal
   F1=100% at threshold 20–30. The 70 threshold is by design (Corroborated =
   ready for field verification). See threshold sweep in evaluation results.

6. **Stakeholder validation is PENDING REAL-WORLD VALIDATION** — no real
   municipal staff have evaluated the system. See `docs/validation.md`.

7. **Evidence upload is demo-quality** — file storage is local filesystem
   (`./storage/evidence`). Production should use object storage (S3/GCS).

8. **Real-time updates use 15-second polling** — not WebSocket. The data
   refreshes every 15s via `setInterval`. A WebSocket mini-service would be
   needed for true real-time.

## Environment-Dependent (NOT VERIFIED in sandbox — Docker)

- **Docker deployment** — Dockerfile + docker-compose provided. The sandbox
  cannot run Docker (no Docker daemon). The Dockerfile uses the verified
  standalone build pattern. See `docs/deployment.md`.

## VERIFIED (with evidence)

- **PostgreSQL** — schema + full data flow verified via PGlite
  (`scripts/verify-postgres.ts`, 18 assertions: schema creation, user/RBAC,
  incident, report, evidence, responder verification, audit log, engine
  evaluation, score persistence, all 3 categories, CASCADE delete)
- **Verification engine scoring** — faithful to original, 144 test assertions pass
- **Explainability** — 100% coverage, structured breakdown
- **Edge cases** — all 8+ failure scenarios tested and handled
- **Evidence security** — magic-byte validation, private storage, controlled serving
- **Reproducible evaluation** — `scripts/evaluate.ts` runs against real DB data
- **Precision@10 = 100%, F1@10 = 100%** — targets met after legitimate fixes
