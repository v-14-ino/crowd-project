# Experimental Evaluation Results

> **Reproducible**: regenerate with `bunx tsx scripts/evaluate.ts --reseed`.
> Generated: 2026-09-28T10:41:53.180Z
> Dataset: 19 incidents, 42 reports, 10 ground-truth-high, 9 ground-truth-low.

## Methodology

The evaluation runs the **verification engine** against the reproducible simulated experiment (seeded in SQLite). Each incident is evaluated with the same rules used in production:

- **Freshness**: Fresh (≤24h), Aging (24–72h), Stale (>72h)
- **Duplicate detection**: same category + issue type, ≤25 m, ≤10 min
- **Confidence**: base 10 + corroboration (20 each, max 60) + evidence (15 + 15 HQ) − missing location (30) − conflicts (40); responder Verified → 100, Rejected → 0
- **Priority**: severity base + corroboration impact + confidence×0.2 + freshness penalty

**Ground truth** is assigned per scenario in `src/lib/seed.ts` (`groundTruthVerified`): true-high-priority incidents that should be surfaced, and false cases (duplicates, stale, conflicts, missing data, responder-rejected) that should NOT dominate the top of the queue.

## Baseline → Target → Measured

| Metric | Target | Baseline (severity+recency) | Prototype (verification engine) | Target met? |
|--------|--------|------------------------------|----------------------------------|-------------|
| Precision@10 | ≥ 80% | 50.0% | 60.0% | No |
| Precision@20 | ≥ 75% | 52.6% | 52.6% | No |
| Recall@20 | ≥ 80% | 100.0% | 100.0% | Yes |
| F1@10 | ≥ 80% | — | 60.0% | No |
| High-pri detection | ≥ 80% | — | 80.0% | Yes |
| Total latency | ≤ 2.0s | — | 0.0003s | Yes |
| Explainability | 100% | — | 100% | Yes |

## Verification Decision Metrics (confidence ≥ 70 threshold)

| Metric | Value |
|--------|-------|
| True positives (TP) | 1 |
| False positives (FP) | 1 |
| False negatives (FN) | 9 |
| True negatives (TN) | 8 |
| Precision | 50.0% |
| Recall | 10.0% |
| F1 | 16.7% |
| Accuracy | 47.4% |

## Precision–Recall Threshold Sweep

Confidence threshold sweep (0–100, step 10). The operational threshold of **70** is selected because it corresponds to the engine's definition of "High confidence" (≥70 = Corroborated), which is the documented decision boundary for surfacing incidents for field verification without requiring responder on-site confirmation.

| Threshold | TP | FP | FN | TN | Precision | Recall | F1 |
|-----------|----|----|----|----|-----------|--------|-----|
| 0 | 10 | 9 | 0 | 0 | 52.6% | 100.0% | 69.0% |
| 10 | 10 | 6 | 0 | 3 | 62.5% | 100.0% | 76.9% |
| 20 | 9 | 1 | 1 | 8 | 90.0% | 90.0% | 90.0% |
| 30 | 9 | 1 | 1 | 8 | 90.0% | 90.0% | 90.0% |
| 40 | 6 | 1 | 4 | 8 | 85.7% | 60.0% | 70.6% |
| 50 | 5 | 1 | 5 | 8 | 83.3% | 50.0% | 62.5% |
| 60 | 5 | 1 | 5 | 8 | 83.3% | 50.0% | 62.5% |
| 70 | 1 | 1 | 9 | 8 | 50.0% | 10.0% | 16.7% |
| 80 | 1 | 0 | 9 | 9 | 100.0% | 10.0% | 18.2% |
| 90 | 1 | 0 | 9 | 9 | 100.0% | 10.0% | 18.2% |
| 100 | 1 | 0 | 9 | 9 | 100.0% | 10.0% | 18.2% |

## Ranking Quality

| | Baseline | Prototype |
|--|----------|-----------|
| Mean rank of true-high incidents | 9.4 | 8.5 |
| Median rank of true-high incidents | 10.5 | 9.5 |

## Latency

| | Value |
|--|-------|
| Total evaluation latency | 0.0003 s |
| Average per incident | 0.0173 ms |
| Median per incident | 0.0094 ms |

## Freshness Classification Accuracy

100.0% of incidents had their persisted freshness match the engine's recomputed freshness (consistency check).

## Per-Incident Ranking (Prototype)

| Rank | Incident | Category | Zone | GT | Baseline | Prototype | Conf | Status |
|------|----------|----------|------|----|----------|-----------|------|--------|
| 1 | INC-3ECAD40B6385 | Roads/pothole | Central Zone | duplicate | 100 | 100 | 70 | Corroborated |
| 2 | INC-77079CA5D73B | Roads/pothole | Central Zone | HIGH | 100 | 87 | 60 | Pending |
| 3 | INC-372BED867957 | Roads/road_blockage | North Zone | HIGH | 100 | 87 | 60 | Pending |
| 4 | INC-5BC6519F407D | Roads/pothole | North Zone | HIGH | 100 | 87 | 60 | Pending |
| 5 | INC-8264AAAAD554 | Roads/pothole | West Zone | conflicting_evidence | 100 | 75 | 0 | Conflicted |
| 6 | INC-03D2A25DFD67 | Street Lighting/streetlight_not_working | Old Town | HIGH | 80 | 70 | 100 | Verified |
| 7 | INC-3F7E022A324C | Waste/illegal_dumping | Industrial Park | responder_rejected | 100 | 70 | 0 | Rejected |
| 8 | INC-4601DF6B7563 | Street Lighting/dark_area | North Zone | missing_location | 100 | 70 | 0 | Unknown |
| 9 | INC-DDA231B00328 | Waste/overflowing_bin | Central Zone | HIGH | 80 | 67 | 60 | Pending |
| 10 | INC-6CE4CABF94F5 | Street Lighting/dark_area | East Zone | HIGH | 80 | 64 | 45 | Pending |
| 11 | INC-E0535B0DBB0C | Roads/damaged_road | South Zone | HIGH | 80 | 61 | 30 | Pending |
| 12 | INC-7E9CD8D3F7FF | Street Lighting/damaged_light | West Zone | HIGH | 80 | 61 | 30 | Pending |
| 13 | INC-1F1869AC018A | Waste/garbage_accumulation | Industrial Park | HIGH | 80 | 52 | 10 | Pending |
| 14 | INC-2AE04586C211 | Roads/damaged_road | South Zone | stale | 100 | 42 | 10 | Pending |
| 15 | INC-6F253A3F73AE | Waste/overflowing_bin | Harbor District | HIGH | 60 | 41 | 30 | Pending |
| 16 | INC-F8E28837E11F | Waste/overflowing_bin | Harbor District | missing_evidence | 60 | 32 | 10 | Pending |
| 17 | INC-C07FDC6ED290 | Roads/pothole | South Zone | normal | 40 | 12 | 10 | Pending |
| 18 | INC-05884D8905CE | Street Lighting/streetlight_not_working | East Zone | normal | 40 | 12 | 10 | Pending |
| 19 | INC-EB023D5DCA8E | Waste/garbage_accumulation | Central Zone | normal | 40 | 12 | 10 | Pending |

## Error Analysis

### False positives (ground-truth-low but confidence ≥ 70)

- `INC-3ECAD40B6385` — duplicate — status Corroborated — confidence 70

### False negatives (ground-truth-high but confidence < 70)

- `INC-77079CA5D73B` — status Pending — confidence 60
- `INC-372BED867957` — status Pending — confidence 60
- `INC-5BC6519F407D` — status Pending — confidence 60
- `INC-DDA231B00328` — status Pending — confidence 60
- `INC-6CE4CABF94F5` — status Pending — confidence 45
- `INC-E0535B0DBB0C` — status Pending — confidence 30
- `INC-7E9CD8D3F7FF` — status Pending — confidence 30
- `INC-1F1869AC018A` — status Pending — confidence 10
- `INC-6F253A3F73AE` — status Pending — confidence 30

## Status

- **Baseline**: COMPLETE (severity + recency ranking)
- **Targets**: COMPLETE (documented in `docs/evaluation_targets.md`)
- **Validation dataset**: CREATED (19 reproducible scenarios in `src/lib/seed.ts`)
- **Ground truth**: CREATED (per-scenario `groundTruthVerified` label)
- **Experiment**: RUN (this script)
- **Results**: AVAILABLE (`scripts/evaluation_output.json`)
- **Error analysis**: AVAILABLE (above)
- **Stakeholder validation**: PENDING (see `docs/validation.md`)
