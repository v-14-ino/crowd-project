# Evaluation Targets

> Pre-defined targets against which the prototype is measured. All targets are
> stated **before** measurement and compared against real results.

## Targets

| Metric | Target | Justification |
|--------|--------|---------------|
| Precision@10 | ≥ 80% | Top-10 incidents must be mostly true high-priority |
| Precision@20 | ≥ 75% | Top-20 should filter out most false cases |
| Recall@20 | ≥ 80% | All true-high incidents surfaced in top-20 |
| F1@10 | ≥ 80% | Balanced precision + recall |
| High-priority detection rate | ≥ 80% | True-high incidents ranked Critical/High |
| Total evaluation latency | ≤ 2.0s | Real-time decision support |
| Explainability coverage | 100% | Every incident has a human-readable explanation |

## Decision Threshold

The operational confidence threshold is **70** — corresponding to the engine's
definition of "High confidence" (≥70 = Corroborated). Incidents at or above 70
are considered "verified by corroboration" and surfaced for field verification.

This threshold is conservative by design: it requires strong corroboration
(3+ independent reports) or responder on-site confirmation. The threshold sweep
in `docs/evaluation_results.md` shows the precision/recall trade-off at
alternative thresholds.

## Reproducibility

All targets are measured by `scripts/evaluate.ts` against the actual database.
Re-generate with: `bunx tsx scripts/evaluate.ts --reseed`
