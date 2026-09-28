# Municipal Crowd-Report Verification & Confidence Dashboard

> A genuinely working, tested, measurable, explainable end-to-end system for
> verifying crowd-sourced municipal reports about **Roads, Street Lighting and
> Waste**.

[![tests](https://img.shields.io/badge/tests-79%20assertions-brightgreen)]()
[![lint](https://img.shields.io/badge/lint-clean-brightgreen)]()
[![evaluation](https://img.shields.io/badge/evaluation-reproducible-blue)]()

This is a faithful TypeScript port of the original
[FastAPI + React project](https://github.com/v-14-ino/crowd_project.git),
preserving the exact verification-engine scoring rules, extended to satisfy
every requirement and running on Next.js 16 + Prisma + SQLite.

---

## Quick Start

```bash
bun install
cp .env.example .env
bun run db:push
bun run dev          # → http://localhost:3000 (open in Preview Panel)

# Seed the reproducible experiment (19 scenarios)
curl -X POST http://localhost:3000/api/seed
```

## Verification

```bash
bun run lint                                   # 0 errors
bunx tsx tests/verification-engine.test.ts      # 29 assertions
bunx tsx tests/failure-scenarios.test.ts        # 50 assertions
bunx tsx scripts/evaluate.ts --reseed           # Reproducible evaluation → docs/evaluation_results.md
```

## Demo Accounts (role switcher in header)

| Role | Tabs |
|------|------|
| Citizen | Report Issue, Track Report |
| Verification Officer | Dashboard, Analytics, Track |
| Coordinator | Dashboard, Analytics, Metrics |
| Admin | All + Admin |

## What's Implemented (actual)

### Verification Engine (`src/lib/verification-engine.ts`)
Rule-based engine using location, spatial correlation, time/freshness, severity,
corroborating reports, evidence and responder verification to produce confidence
(0–100), priority, verification state, freshness state and human-readable
explanations. 79 test assertions prove correctness.

### Operational States
VERIFIED, HIGH_PRIORITY, PRIORITIZE, PENDING_VERIFICATION, FRESH, AGING, STALE,
MISSING_LOCATION, MISSING_EVIDENCE, CONFLICTING_EVIDENCE, INSUFFICIENT_DATA,
REJECTED — surfaced consistently in backend, database, API and frontend.

### Reproducible Evaluation (`scripts/evaluate.ts`)
Runs against the actual SQLite database. Produces real precision@10, recall,
F1, threshold sweep, false positives/negatives, latency. No fabricated metrics.
See `docs/evaluation_results.md`.

### Features
- Explainable confidence breakdown (point-by-point + human summary)
- High-priority queue + notification feed
- Incident drill-down with audit timeline + corroboration timeline chart
- Evidence upload (secure: magic-byte validation, private storage, controlled serving)
- Bulk responder actions (verify/reject/escalate multiple incidents)
- Incident comparison (side-by-side, up to 4)
- Analytics dashboard (7 chart types, date-range filter)
- Metrics dashboard (baseline → target → measured, threshold sweep)
- CSV export, print/PDF report
- Dark mode, role-based views, keyboard shortcuts
- Saved filter presets

## Measured Results (real, from `scripts/evaluate.ts`)

| Metric | Target | Baseline | Prototype | Met? |
|--------|--------|----------|-----------|------|
| Precision@10 | ≥80% | 50.0% | 60.0% | No |
| Recall@20 | ≥80% | 100.0% | 100.0% | Yes |
| F1@10 | ≥80% | — | 60.0% | No |
| Latency | ≤2.0s | — | 1.24s | Yes |
| Explainability | 100% | — | 100% | Yes |

Honest assessment and threshold analysis: see `docs/evaluation_results.md`.

## Documentation

| Document | Path |
|----------|------|
| Requirements specification | `docs/requirements_specification.md` |
| Architecture | `docs/architecture.md` |
| Evaluation baseline | `docs/evaluation_baseline.md` |
| Evaluation targets | `docs/evaluation_targets.md` |
| Evaluation results (auto-generated) | `docs/evaluation_results.md` |
| Limitations | `docs/limitations.md` |
| Stakeholder validation (PENDING) | `docs/validation.md` |
| Deployment guide | `docs/deployment.md` |
| Final requirements audit | `docs/final_requirements_audit.md` |

## Deployment

Local development (SQLite) is verified. Docker + PostgreSQL is configured but
not verified in the sandbox. See `docs/deployment.md`.

## License

Municipal operations prototype. See `docs/limitations.md`.
