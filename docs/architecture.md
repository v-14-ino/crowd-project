# Architecture

> Describes the **actual implemented system**, not planned features.

## Overview

A single-page Next.js 16 application with a rule-based verification engine that
helps municipal decision-makers verify crowd-sourced reports about Roads,
Street Lighting and Waste. The system groups reports into incidents, computes
explainable confidence and priority scores, surfaces high-priority issues, and
tracks responder verification.

## Technology Stack (actual)

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router, Turbopack) | Single deployable, server + client |
| Language | TypeScript 5 (strict) | Type safety end-to-end |
| Database | Prisma ORM + SQLite | Zero-config local dev; PostgreSQL-ready |
| UI | Tailwind CSS 4 + shadcn/ui (New York) | Consistent, accessible components |
| Charts | Recharts | Analytics visualisations |
| Icons | lucide-react | |
| Tests | bunx tsx (TypeScript test runner) | No pytest — environment is Node.js |

## Source of Truth

This implementation is a faithful TypeScript port of the original
[FastAPI + React project](https://github.com/v-14-ino/crowd_project.git),
preserving the exact verification-engine scoring rules. The port was necessary
because the deployment environment supports only Next.js on port 3000.

## Directory Structure

```
src/
├── app/
│   ├── page.tsx                      # Single-page dashboard (role-based views)
│   ├── layout.tsx                    # Root layout + theme provider + toaster
│   └── api/
│       ├── reports/                  # POST submit, GET recent, GET by id
│       ├── incidents/                # GET queue, GET detail, GET stats, GET export, POST bulk-verify, GET compare
│       ├── incidents/[id]/           # detail, verification, evidence (+upload), audit
│       ├── evidence/[id]/            # DELETE
│       ├── uploads/evidence/[name]/  # Controlled file serving (secure)
│       ├── analytics/                # GET aggregated distributions
│       ├── metrics/                   # GET live evaluation (baseline vs proposed)
│       ├── seed/                      # POST reproducible experiment
│       └── auth/session/             # POST role session
├── lib/
│   ├── verification-engine.ts        # ⭐ Rule-based engine (ported from Python)
│   ├── correlation.ts                # Spatial/temporal report→incident matching
│   ├── db.ts                         # Prisma client
│   ├── db-ops.ts                     # Submit/attach/verify/recompute persistence
│   ├── seed.ts                       # ⭐ 19-scenario reproducible experiment
│   ├── session.ts                    # Role-based demo session
│   ├── types.ts                      # Shared domain types
│   └── api-client.ts                 # Fetch wrapper + time helpers
├── components/dashboard/             # badges, kpi-cards, filter-bar, incident-queue,
│                                     # incident-drilldown, incident-map, report-form,
│                                     # metrics-panel, analytics-panel, audit-timeline,
│                                     # comparison-dialog, bulk-actions-sheet, etc.
├── components/ui/                    # shadcn/ui component set
tests/
├── verification-engine.test.ts       # 29 assertions — engine correctness
└── failure-scenarios.test.ts         # 50 assertions — edge/failure cases
scripts/
└── evaluate.ts                       # ⭐ Reproducible evaluation (precision@10, F1, threshold sweep)
prisma/
└── schema.prisma                     # User, Report, Incident, IncidentReport,
                                      # ExternalEvidence, ResponderVerification,
                                      # EvaluationLabel, AuditLog
docs/                                 # requirements, architecture, evaluation, validation, deployment
```

## Verification Engine (`src/lib/verification-engine.ts`)

The core rule-based engine. Pure functions, fully tested.

### Inputs (genuinely used)
- **Location** (latitude/longitude) — haversine spatial correlation
- **Timestamp** (reportedTime) — freshness + temporal correlation
- **Severity** (citizen severity) — priority base
- **Corroborating reports** — deduplicated, counted for confidence
- **Evidence** (external evidence array) — confidence bonus
- **Responder verification** — overrides confidence (Verified=100, Rejected=0)

### Outputs
- **Confidence score** (0–100) + level (High/Medium/Low)
- **Priority score** (0–100) + level (Critical/High/Medium/Low)
- **Freshness** (Fresh/Aging/Stale/Unknown)
- **Verification status** (Verified/Rejected/Conflicted/Corroborated/Pending/Unknown)
- **Operational states** (VERIFIED, HIGH_PRIORITY, PRIORITIZE, PENDING_VERIFICATION, FRESH, AGING, STALE, MISSING_LOCATION, MISSING_EVIDENCE, CONFLICTING_EVIDENCE, INSUFFICIENT_DATA, REJECTED)
- **Human-readable explanation** (structured point-by-point breakdown + summary)
- **Recommended action** (explainable decision support)

### Scoring rules (faithful to original)
See `docs/evaluation_results.md` § Methodology for the exact formulas.

## Data Model

```
User 1──* ResponderVerification *──1 Incident
                                     ├──* IncidentReport *──1 Report 1──1 EvaluationLabel
                                     ├──* ExternalEvidence
                                     ├──* ResponderVerification
                                     └──* AuditLog
```

- A **Report** belongs to exactly one **Incident** (via IncidentReport).
- An **Incident** groups spatially/temporally correlated reports.
- **ExternalEvidence** attaches to an incident (optional report link).
- **ResponderVerification** records an officer's Verify/Reject/Escalate decision.
- **EvaluationLabel** stores ground truth + simulated scores (for metrics).
- **AuditLog** records all actions (report_submitted, evidence_attached,
  responder_verified, seed_run, filter_preset).

## Role-Based Access

| Role | Tabs | Capabilities |
|------|------|-------------|
| Citizen | Report Issue, Track Report | Submit reports, track by ID |
| Verification Officer | Dashboard, Analytics, Track | Review, verify/reject/escalate, evidence, bulk actions |
| Coordinator | Dashboard, Analytics, Metrics | Municipality overview, high-priority queue, metrics |
| Admin | All + Admin | Re-seed, system management |

Role switching uses a signed cookie session (`src/lib/session.ts`). In
production this would be replaced by NextAuth/JWT — see Limitations.

## Reproducible Evaluation

`scripts/evaluate.ts` runs against the actual SQLite database:
1. Optionally re-seeds (`--reseed`)
2. Loads all incidents + reports + evidence + verifications + labels
3. Evaluates each with the verification engine
4. Computes baseline (severity+recency) vs proposed (engine) rankings
5. Outputs precision@10, @20, recall, F1, threshold sweep, FP/FN, latency
6. Writes `scripts/evaluation_output.json` + `docs/evaluation_results.md`

**Every number in the metrics dashboard comes from this live computation** —
nothing is hardcoded or fabricated.
