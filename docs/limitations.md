# Limitations

> Honest limitations of the **actual implemented system**.

## Verified Limitations

1. **SQLite database** — used for local development and demo. Production
   deployment should use PostgreSQL (configuration provided in `docker-compose.yml`,
   not verified in sandbox).

2. **Role-based access is a lightweight cookie session** — not production RBAC.
   The session is signed with HMAC but does not use NextAuth/JWT. In production,
   replace `src/lib/session.ts` with NextAuth or an equivalent.

3. **Spatial map is an SVG scatter plot** — not Leaflet/OpenStreetMap. Suitable
   for the demo bounding box but not for real geographic data at scale.

4. **Precision@10 = 60% (target 80% — NOT MET)** — the duplicate-spam edge
   case (10 Critical reports of the same pothole) retains elevated priority
   because severity base is 70 and the engine's confidence penalty (dedup
   → 50) only reduces priority via the 0.2 confidence weight. The ranking
   still improves over baseline (mean rank 9.4 → 8.4). See
   `docs/evaluation_results.md` for the full threshold sweep.

5. **Operational confidence threshold (70) is conservative** — at threshold 70,
   F1 = 18.2% because only responder-verified incidents reach 70 in the current
   dataset. The optimal F1 (90%) is at threshold 20–30. The 70 threshold is
   by design (Corroborated = ready for field verification); lowering it would
   increase recall but also false positives. See threshold sweep.

6. **Stakeholder validation is PENDING** — no real municipal staff have
   evaluated the system. See `docs/validation.md`.

7. **Evidence upload is demo-quality** — file storage is local filesystem
   (`./storage/evidence`). Production should use object storage (S3/GCS).

8. **Real-time updates use 15-second polling** — not WebSocket. The data
   refreshes every 15s via `setInterval`. A WebSocket mini-service would be
   needed for true real-time.

## Environment-Dependent (NOT VERIFIED in sandbox)

- **Docker deployment** — Dockerfile + docker-compose provided but the sandbox
  cannot run Docker. See `docs/deployment.md`.
- **PostgreSQL** — Prisma schema supports it; switching requires changing the
  provider in `schema.prisma`. Not verified.
- **Production build** — `bun run build` produces a standalone server; not
  verified in sandbox (dev server only).

## Not a Limitation (verified working)

- Verification engine scoring — faithful to original, 79 test assertions pass
- Explainability — 100% coverage, structured breakdown
- Edge cases — all 8+ failure scenarios tested and handled
- Evidence security — magic-byte validation, private storage, controlled serving
- Reproducible evaluation — `scripts/evaluate.ts` runs against real DB data
