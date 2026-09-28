# Municipal Crowd-Report Verification & Confidence Dashboard

> Decision-support dashboard that helps municipal decision-makers **verify crowd-sourced reports quickly** about **Roads, Street Lighting and Waste**, using citizen reports, location, timestamp, corroborating sources, evidence, responder verification, explainable confidence scoring, priority, freshness and explicit operational states.

This is a complete, demo-ready implementation built on **Next.js 16 + TypeScript + Prisma (SQLite) + shadcn/ui**. The verification engine, correlation logic, data models, edge-case handling and evaluation methodology are faithfully ported from the original FastAPI + React project ([v-14-ino/crowd_project](https://github.com/v-14-ino/crowd_project.git)) and extended to satisfy the full requirements specification.

---

## Problem

A municipality receives crowd-sourced complaints about **Roads, Street Lighting and Waste**. Decision-makers cannot verify these reports quickly enough. The system must:

- Group duplicate/nearby reports into incidents (spatial + temporal correlation)
- Compute an **explainable confidence score** (with a point-by-point breakdown)
- Compute a **priority score** (severity + corroboration + confidence + freshness)
- Surface **explicit operational states** (VERIFIED, HIGH_PRIORITY, STALE, MISSING_LOCATION, CONFLICTING_EVIDENCE, etc.)
- Provide **role-based views** (Citizen, Verification Officer, Coordinator, Admin)
- Surface **verified high-priority incidents quickly**
- Provide a **metrics dashboard** with baseline → target → measured result
- Handle **edge/failure cases** (duplicates, stale, missing location, conflicts, missing evidence, responder rejection)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | Prisma ORM + SQLite |
| UI | Tailwind CSS 4 + shadcn/ui (New York) |
| Icons | lucide-react |
| Charts/Tables | recharts + @tanstack/react-table |

---

## Quick Start

```bash
# 1. Install dependencies (already done in this environment)
bun install

# 2. Push the database schema
bun run db:push

# 3. Start the dev server (port 3000)
bun run dev

# 4. Open the app in the Preview Panel (right side of the interface)
#    or click "Open in New Tab".
```

The first time you open the dashboard, click **"Seed demo data"** in the top status bar
(or visit the **Admin → Re-seed experiment** button) to populate the reproducible
simulated experiment (19 scenarios covering every edge case).

### Demo accounts (role switcher in the header)

| Role | Capabilities |
|------|--------------|
| **Citizen** | Submit reports, track by Report ID / Incident ID |
| **Verification Officer** | Dashboard, drill-down, verify / reject / escalate, attach evidence |
| **Coordinator** | Municipality-wide overview, high-priority queue, metrics |
| **Admin** | All views + re-seed experiment + system config |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                      # Single-page dashboard (role-based views)
│   ├── layout.tsx                    # Root layout + Sonner toaster
│   └── api/
│       ├── auth/session/route.ts     # Role session (cookie-based)
│       ├── reports/route.ts          # POST submit a citizen report
│       ├── reports/recent/route.ts   # GET recent reports feed
│       ├── reports/[id]/route.ts      # GET report by ID
│       ├── incidents/route.ts         # GET filtered incident queue
│       ├── incidents/[id]/route.ts   # GET incident drill-down (with live evaluation)
│       ├── incidents/stats/route.ts  # GET aggregate KPIs
│       ├── incidents/[id]/verification/route.ts  # POST responder verify/reject/escalate
│       ├── incidents/[id]/evidence/route.ts     # GET/POST evidence
│       ├── evidence/[id]/route.ts    # DELETE evidence
│       ├── metrics/route.ts          # GET live evaluation (baseline vs proposed)
│       └── seed/route.ts             # POST reproducible simulated experiment
├── lib/
│   ├── verification-engine.ts        # ⭐ Rule-based engine (ported from Python)
│   ├── correlation.ts                # Spatial/temporal report→incident matching
│   ├── db.ts                         # Prisma client
│   ├── db-ops.ts                     # Submit/attach/verify + recompute persistence
│   ├── seed.ts                       # ⭐ Reproducible 19-scenario experiment
│   ├── session.ts                    # Role-based demo session
│   ├── types.ts                      # Shared domain types
│   └── api-client.ts                 # Fetch wrapper + time helpers
├── components/dashboard/
│   ├── badges.tsx                    # Status / priority / confidence / op-state badges + bars
│   ├── kpi-cards.tsx                 # Clickable KPI summary
│   ├── filter-bar.tsx                # SQL-style filters
│   ├── incident-queue.tsx            # Prioritised incident table
│   ├── incident-drilldown.tsx        # ⭐ Drill-down with explainable confidence
│   ├── incident-map.tsx              # SVG spatial map
│   ├── report-form.tsx               # Citizen report submission
│   └── metrics-panel.tsx             # Baseline → target → measured dashboard
└── tests/
    └── verification-engine.test.ts   # 12 scenarios, 29 assertions
```

---

## Verification Engine (the core)

Located in `src/lib/verification-engine.ts`. Faithfully ports the original Python rules:

### Freshness
| Age | State |
|-----|-------|
| ≤ 24h | **Fresh** |
| 24–72h | **Aging** |
| > 72h | **Stale** |

### Duplicate detection (deduplication)
Two reports are duplicates if: **same category + issue type** AND **≤ 25 m apart** AND **≤ 10 min apart**.
Duplicate reports are filtered before confidence/priority calculation so spam cannot inflate scores.

### Confidence score (0–100)
| Component | Points |
|-----------|--------|
| Base (initial citizen report) | +10 |
| Each independent corroborating report | +20 (max +60) |
| Evidence attached | +15 |
| High-quality / verified evidence | +15 |
| Missing precise location | −30 |
| Conflicting evidence | −40 |
| **Responder Verified** | **= 100 (override)** |
| **Responder Rejected** | **= 0 (override)** |

### Priority score (0–100)
| Component | Points |
|-----------|--------|
| Base severity (Critical 70 / High 50 / Medium 30 / Low 10) | base |
| Each corroborating report | +5 (max +20) |
| Confidence adjustment | +confidence × 0.2 |
| Aging freshness | −10 |
| Stale freshness | −30 |

### Verification status
`Verified` · `Rejected` · `Conflicted` · `Corroborated` (≥70 conf) · `Pending` · `Unknown`

### Operational states (surfaced in the UI)
`VERIFIED` · `HIGH_PRIORITY` · `PRIORITIZE` · `PENDING_VERIFICATION` · `STALE` · `AGING` · `FRESH` · `MISSING_LOCATION` · `MISSING_EVIDENCE` · `CONFLICTING_EVIDENCE` · `INSUFFICIENT_DATA` · `REJECTED`

Every score comes with a **structured point-by-point breakdown** and a **human-readable summary**, e.g.:

> **High confidence**: multiple citizens reported the same issue within a short time window and/or supporting evidence was available.

---

## Reproducible Simulated Experiment

`src/lib/seed.ts` seeds **19 scenarios** with ground-truth labels:

| # | Scenario | Ground truth |
|---|----------|--------------|
| 1–10 | High-priority incidents (potholes, road blockage, streetlights, waste) — corroborated, with evidence, some responder-verified | HIGH |
| 11–13 | Low/medium isolated reports | LOW |
| 14 | Conflicting evidence (pothole vs normal road) | EDGE |
| 15 | Stale report (5 days old, critical severity) | EDGE |
| 16 | Duplicate spam (10 reports from same spot) | EDGE |
| 17 | Responder-rejected false alarm | EDGE |
| 18 | Missing location (critical, no GPS) | EDGE |
| 19 | Missing evidence / insufficient data | EDGE |

Ground-truth labels are stored in the `EvaluationLabel` table and used by the metrics dashboard to compute precision, recall and error analysis.

---

## Metrics & Evaluation

The **Metrics** tab (visible to Coordinator and Admin) runs the full evaluation live:

- **Baseline** = severity + recency only (no verification engine)
- **Proposed** = verification-engine priority ranking
- Metrics: Precision@10, Precision@20, High-priority recall, mean/median rank, total latency, explainability coverage, false positives, false negatives, high-priority detection rate, verification accuracy, median verification time, freshness classification accuracy, confidence calibration.
- Per-incident ranking table with ground-truth comparison.
- Error analysis section listing false positives and false negatives.

The original evaluation results are preserved in `docs/evaluation_results.md`.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reports` | Submit a citizen report (auto-correlates + recomputes) |
| `GET` | `/api/reports/recent?limit=10` | Recent reports feed |
| `GET` | `/api/reports/{id}` | Report detail |
| `GET` | `/api/incidents?...` | Filtered incident queue (category, status, priority, confidence, freshness, zone, search) |
| `GET` | `/api/incidents/{id}` | Full drill-down with live confidence breakdown |
| `GET` | `/api/incidents/stats` | Aggregate KPIs |
| `POST` | `/api/incidents/{id}/verification` | Responder verify/reject/escalate |
| `GET`/`POST` | `/api/incidents/{id}/evidence` | List / attach evidence |
| `DELETE` | `/api/evidence/{id}` | Delete evidence |
| `GET` | `/api/metrics` | Live evaluation (baseline vs proposed) |
| `POST` | `/api/seed` | Re-seed the reproducible experiment |
| `POST`/`GET` | `/api/auth/session` | Switch role session |

---

## Testing

```bash
bunx tsx tests/verification-engine.test.ts
```

12 scenarios, 29 assertions covering: normal verification, duplicate deduplication, stale reports, missing location, conflicting evidence, missing evidence/insufficient data, responder verification override, responder rejection, high-priority detection, haversine distance, baseline ranking, evidence boosting.

```bash
bun run lint   # ESLint — must pass
```

---

## End-to-End Demonstration

1. **Citizen submits a road complaint** → switch to *Citizen* → *Report Issue* → fill the form → submit.
2. **Another citizen reports the same issue nearby** → the correlation engine groups both into one incident.
3. **Evidence is attached** → open the incident drill-down → *Attach evidence* → confidence recomputes live.
4. **Confidence is calculated** with a full point-by-point breakdown.
5. **Freshness is evaluated** (Fresh/Aging/Stale).
6. **Priority is calculated**.
7. **Dashboard surfaces the incident** in the high-priority queue.
8. **Officer opens drill-down** → sees the explainable confidence.
9. **System explains WHY confidence is high.**
10. **Responder confirms** → *Verify* → incident becomes VERIFIED.
11. **Decision-maker sees the high-priority incident** in the coordinator view.
12. **Metrics show the result** → *Metrics* tab → baseline vs proposed.

**Edge cases demonstrated**: switch to the *Dashboard* and look for STALE, MISSING_LOCATION, CONFLICTING_EVIDENCE, INSUFFICIENT_DATA, REJECTED badges.

---

## Documentation

| Document | Path |
|----------|------|
| Requirements specification | `docs/requirements_specification.md` |
| Evaluation baseline | `docs/evaluation_baseline.md` |
| Evaluation targets | `docs/evaluation_targets.md` |
| Evaluation results | `docs/evaluation_results.md` |
| Limitations | `docs/limitations.md` |
| Stakeholder validation | `docs/stakeholder_validation.md` |
| Final requirements audit | `docs/final_requirements_audit.md` |

---

## Limitations

See `docs/limitations.md`. Key points:

- SQLite is used for the demo (production would use PostgreSQL).
- Role switching is a lightweight cookie-based demo session (production would use NextAuth/JWT).
- The map is an SVG scatter plot (production would use Leaflet/OpenStreetMap).
- Evidence file upload is simulated metadata (the API accepts uploads but the demo uses simulated sources).

---

## Commands

```bash
bun run dev        # Start dev server on port 3000
bun run lint       # ESLint
bun run db:push    # Push Prisma schema to SQLite
bun run db:generate# Regenerate Prisma client
bunx tsx tests/verification-engine.test.ts   # Run verification engine tests
```
