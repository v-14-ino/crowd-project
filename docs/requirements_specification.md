# Requirements Specification

> Describes the **actual implemented system**.

## 1. Problem Statement

A municipality receives crowd-sourced complaints about **Roads, Street Lighting
and Waste**. Decision-makers cannot verify these reports quickly enough. The
system must help them verify reports using citizen reports, location,
timestamp, corroborating sources, evidence, responder verification, confidence
scoring, priority, freshness and explainable decisions.

## 2. Functional Requirements

### 2.1 Municipal Issue Categories
The system explicitly supports three categories with issue types:
- **Roads**: pothole, damaged_road, road_blockage
- **Street Lighting**: streetlight_not_working, damaged_light, dark_area
- **Waste**: garbage_accumulation, overflowing_bin, illegal_dumping

These appear in report submission, seed data, dashboard, filtering, incidents,
verification and priority handling.

### 2.2 Citizen Report Submission
A citizen can submit a report with: category, issue type, description, zone,
GPS coordinates (optional), severity, name, and conflicting-evidence flag.

### 2.3 Verification Engine
The engine genuinely uses location, spatial correlation, time/freshness,
severity, corroborating reports, evidence and responder verification to
produce confidence (0–100), priority, verification state, freshness state and
human-readable explanations.

### 2.4 Operational States
The system explicitly handles: VERIFIED, HIGH_PRIORITY, PRIORITIZE,
PENDING_VERIFICATION, FRESH, AGING, STALE, MISSING_LOCATION, MISSING_EVIDENCE,
CONFLICTING_EVIDENCE, INSUFFICIENT_DATA, REJECTED.

### 2.5 Role-Based Views
- **Citizen**: submit report, track report
- **Verification Officer**: review, evidence, confidence explanation, verify/reject/escalate, handle conflicts, bulk actions
- **Coordinator**: high-priority queue, municipality overview, filters, drill-down, metrics
- **Admin**: re-seed, system management, all views

### 2.6 Drill-Down
Clicking an incident shows: report details, category, location, timestamp,
severity, confidence, confidence breakdown, corroborating reports, evidence,
responder verification, freshness, operational state, verification history,
audit timeline, recommended next action.

### 2.7 High-Priority Surfacing
Verified high-priority reports are surfaced quickly via a dedicated
high-priority queue band, priority-sorted incident table, and notification feed.

### 2.8 Evaluation System
Reproducible evaluation measuring: verification accuracy, precision, recall, F1,
false positives, false negatives, high-priority detection, verification latency,
freshness classification, ranking quality, precision@10. See
`scripts/evaluate.ts`.

### 2.9 Edge/Failure Cases
At minimum: duplicate reports, stale report, missing location, conflicting
evidence, missing/corrupt evidence, corroboration unavailable, responder
rejection, empty input. See `tests/failure-scenarios.test.ts`.

## 3. Non-Functional Requirements

- **Explainability**: every confidence score has a structured point-by-point
  breakdown + human-readable summary.
- **Reproducibility**: the seed + evaluation script produce identical results
  across runs.
- **Performance**: total evaluation latency < 2s for 19 incidents (measured).
- **Security**: evidence uploads validated (magic bytes, extension allowlist,
  size limit), stored outside /public, served via controlled route.
- **Accessibility**: ARIA labels, keyboard navigation, semantic HTML.
- **Responsive**: mobile-first design with sm/md/lg/xl breakpoints.

## 4. Data Requirements

- **Validation dataset**: 19 reproducible scenarios (`src/lib/seed.ts`) with
  ground-truth labels.
- **Ground truth**: per-scenario `groundTruthVerified` boolean.

## 5. Acceptance Criteria

- 79/79 automated test assertions pass (29 engine + 50 failure scenarios)
- ESLint clean
- Reproducible evaluation produces real metrics (`scripts/evaluate.ts`)
- All operational states surface in the UI
- Drill-down shows explainable confidence breakdown
- No console errors
