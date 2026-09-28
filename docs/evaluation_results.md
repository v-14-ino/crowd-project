# Experimental Evaluation Results

> **Reproducible**: regenerate with `bunx tsx scripts/evaluate.ts --reseed`.
> Generated: 2026-09-28T11:01:22.619Z
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
| Precision@10 | ≥ 80% | 50.0% | 100.0% | Yes |
| Precision@20 | ≥ 75% | 52.6% | 52.6% | No |
| Recall@20 | ≥ 80% | 100.0% | 100.0% | Yes |
| F1@10 | ≥ 80% | — | 100.0% | Yes |
| High-pri detection | ≥ 80% | — | 80.0% | Yes |
| Total latency | ≤ 2.0s | — | 0.0014s | Yes |
| Explainability | 100% | — | 100% | Yes |

## Verification Decision Metrics (confidence ≥ 70 threshold)

| Metric | Value |
|--------|-------|
| True positives (TP) | 3 |
| False positives (FP) | 0 |
| False negatives (FN) | 7 |
| True negatives (TN) | 9 |
| Precision | 100.0% |
| Recall | 30.0% |
| F1 | 46.2% |
| Accuracy | 63.2% |

## Precision–Recall Threshold Sweep

Confidence threshold sweep (0–100, step 10). The operational threshold of **70** is selected because it corresponds to the engine's definition of "High confidence" (≥70 = Corroborated), which is the documented decision boundary for surfacing incidents for field verification without requiring responder on-site confirmation.

| Threshold | TP | FP | FN | TN | Precision | Recall | F1 |
|-----------|----|----|----|----|-----------|--------|-----|
| 0 | 10 | 9 | 0 | 0 | 52.6% | 100.0% | 69.0% |
| 10 | 10 | 6 | 0 | 3 | 62.5% | 100.0% | 76.9% |
| 20 | 10 | 0 | 0 | 9 | 100.0% | 100.0% | 100.0% |
| 30 | 9 | 0 | 1 | 9 | 100.0% | 90.0% | 94.7% |
| 40 | 5 | 0 | 5 | 9 | 100.0% | 50.0% | 66.7% |
| 50 | 5 | 0 | 5 | 9 | 100.0% | 50.0% | 66.7% |
| 60 | 5 | 0 | 5 | 9 | 100.0% | 50.0% | 66.7% |
| 70 | 3 | 0 | 7 | 9 | 100.0% | 30.0% | 46.2% |
| 80 | 3 | 0 | 7 | 9 | 100.0% | 30.0% | 46.2% |
| 90 | 1 | 0 | 9 | 9 | 100.0% | 10.0% | 18.2% |
| 100 | 1 | 0 | 9 | 9 | 100.0% | 10.0% | 18.2% |

## Ranking Quality

| | Baseline | Prototype |
|--|----------|-----------|
| Mean rank of true-high incidents | 9.4 | 5.5 |
| Median rank of true-high incidents | 10.5 | 5.5 |

## Latency

| | Value |
|--|-------|
| Total evaluation latency | 0.0014 s |
| Average per incident | 0.0715 ms |
| Median per incident | 0.0318 ms |

## Freshness Classification Accuracy

100.0% of incidents had their persisted freshness match the engine's recomputed freshness (consistency check).

## Per-Incident Ranking (Prototype)

| Rank | Incident | Category | Zone | GT | Baseline | Prototype | Conf | Status |
|------|----------|----------|------|----|----------|-----------|------|--------|
| 1 | INC-86B7FE437043 | Roads/road_blockage | North Zone | HIGH | 100 | 96 | 80 | Corroborated |
| 2 | INC-29DAE86CC0C7 | Roads/pothole | North Zone | HIGH | 100 | 96 | 80 | Corroborated |
| 3 | INC-030C2D742186 | Roads/pothole | Central Zone | HIGH | 100 | 87 | 60 | Pending |
| 4 | INC-E0A57A000571 | Street Lighting/streetlight_not_working | Old Town | HIGH | 80 | 75 | 100 | Verified |
| 5 | INC-A51052D9C4F8 | Waste/overflowing_bin | Central Zone | HIGH | 80 | 67 | 60 | Pending |
| 6 | INC-A4E3327B6421 | Roads/damaged_road | South Zone | HIGH | 80 | 61 | 30 | Pending |
| 7 | INC-25BC8204D8FD | Waste/garbage_accumulation | Industrial Park | HIGH | 80 | 61 | 30 | Pending |
| 8 | INC-CCBC0C3C124D | Street Lighting/damaged_light | West Zone | HIGH | 80 | 61 | 30 | Pending |
| 9 | INC-B614DD25D63A | Street Lighting/dark_area | East Zone | HIGH | 80 | 55 | 25 | Pending |
| 10 | INC-F4D7B346A681 | Waste/overflowing_bin | Harbor District | HIGH | 60 | 41 | 30 | Pending |
| 11 | INC-3830CAFF389C | Roads/pothole | West Zone | conflicting_evidence | 100 | 26 | 0 | Conflicted |
| 12 | INC-AD0448BB6416 | Roads/pothole | Central Zone | duplicate | 100 | 23 | 10 | Pending |
| 13 | INC-93B183173DB5 | Waste/illegal_dumping | Industrial Park | responder_rejected | 100 | 21 | 0 | Rejected |
| 14 | INC-1239553F54E0 | Street Lighting/dark_area | North Zone | missing_location | 100 | 21 | 0 | Unknown |
| 15 | INC-5A4CD75E35ED | Waste/overflowing_bin | Harbor District | missing_evidence | 60 | 11 | 10 | Pending |
| 16 | INC-86556EA8C8E2 | Roads/pothole | South Zone | normal | 40 | 5 | 10 | Pending |
| 17 | INC-35331367A844 | Street Lighting/streetlight_not_working | East Zone | normal | 40 | 5 | 10 | Pending |
| 18 | INC-98CE3491BF6F | Waste/garbage_accumulation | Central Zone | normal | 40 | 5 | 10 | Pending |
| 19 | INC-14F9597CFBB8 | Roads/damaged_road | South Zone | stale | 100 | 0 | 10 | Pending |

## Error Analysis

### False positives (ground-truth-low but confidence ≥ 70)

None.

### False negatives (ground-truth-high but confidence < 70)

- `INC-030C2D742186` — Roads/pothole — expected HIGH_PRIORITY, predicted Pending — confidence 60, priority 87, evidence 1, corroboration 2, freshness Fresh, responder no — **reason**: only 2 independent report(s) — below corroboration threshold
- `INC-A51052D9C4F8` — Waste/overflowing_bin — expected HIGH_PRIORITY, predicted Pending — confidence 60, priority 67, evidence 1, corroboration 2, freshness Fresh, responder no — **reason**: only 2 independent report(s) — below corroboration threshold
- `INC-A4E3327B6421` — Roads/damaged_road — expected HIGH_PRIORITY, predicted Pending — confidence 30, priority 61, evidence 0, corroboration 2, freshness Fresh, responder no — **reason**: low confidence (30) due to insufficient corroboration or evidence; no evidence attached; only 2 independent report(s) — below corroboration threshold
- `INC-25BC8204D8FD` — Waste/garbage_accumulation — expected HIGH_PRIORITY, predicted Pending — confidence 30, priority 61, evidence 0, corroboration 2, freshness Fresh, responder no — **reason**: low confidence (30) due to insufficient corroboration or evidence; no evidence attached; only 2 independent report(s) — below corroboration threshold
- `INC-CCBC0C3C124D` — Street Lighting/damaged_light — expected HIGH_PRIORITY, predicted Pending — confidence 30, priority 61, evidence 0, corroboration 2, freshness Fresh, responder no — **reason**: low confidence (30) due to insufficient corroboration or evidence; no evidence attached; only 2 independent report(s) — below corroboration threshold
- `INC-B614DD25D63A` — Street Lighting/dark_area — expected HIGH_PRIORITY, predicted Pending — confidence 25, priority 55, evidence 1, corroboration 1, freshness Fresh, responder no — **reason**: low confidence (25) due to insufficient corroboration or evidence; only 1 independent report(s) — below corroboration threshold
- `INC-F4D7B346A681` — Waste/overflowing_bin — expected HIGH_PRIORITY, predicted Pending — confidence 30, priority 41, evidence 0, corroboration 2, freshness Fresh, responder no — **reason**: low confidence (30) due to insufficient corroboration or evidence; no evidence attached; only 2 independent report(s) — below corroboration threshold

## Status

- **Baseline**: COMPLETE (severity + recency ranking)
- **Targets**: COMPLETE (documented in `docs/evaluation_targets.md`)
- **Validation dataset**: CREATED (19 reproducible scenarios in `src/lib/seed.ts`)
- **Ground truth**: CREATED (per-scenario `groundTruthVerified` label)
- **Experiment**: RUN (this script)
- **Results**: AVAILABLE (`scripts/evaluation_output.json`)
- **Error analysis**: AVAILABLE (above, with per-incident reasons)
- **Stakeholder validation**: PENDING REAL-WORLD VALIDATION (see `docs/validation.md`)
