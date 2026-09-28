# Evaluation Baseline

> Describes the **actual baseline** used in the reproducible evaluation.

## Baseline Definition

The baseline is a **severity + recency ranking** — the simplest approach a
municipality could take without a verification engine:

1. Rank incidents by maximum citizen severity (Critical > High > Medium > Low)
2. Tie-break by most recent reported time

This baseline does NOT:
- Detect or deduplicate spam reports
- Penalise stale reports
- Penalise missing location
- Detect conflicting evidence
- Consider responder verification
- Consider evidence

## Baseline Scoring

```
baseline_priority = SEVERITY_SCORE[maxSeverity] + recencyBump
```

Where `SEVERITY_SCORE = { Critical: 70, High: 50, Medium: 30, Low: 10 }` and
`recencyBump = 30 if any report exists else 0`.

Implemented in `src/lib/verification-engine.ts` → `baselinePriorityScore()`.

## Measured Baseline Results (real, from `scripts/evaluate.ts`)

| Metric | Baseline result |
|--------|----------------|
| Precision@10 | 50.0% |
| Precision@20 | 52.6% |
| Recall@20 | 100.0% |
| Mean rank of true-high incidents | 9.4 |
| Median rank of true-high incidents | 10.5 |

## Baseline Limitations (observed in the data)

The baseline over-ranks edge cases because they carry "Critical" severity:
- **Duplicate spam** (10 Critical reports of same pothole) ranks #1
- **Conflicting evidence** (Critical) ranks high
- **Responder-rejected false alarm** (Critical) ranks high
- **Stale report** (5-day-old Critical) ranks high
- **Missing location** (Critical, no GPS) ranks high

The verification engine penalises all of these, improving ranking quality.
