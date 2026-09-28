/**
 * Reproducible evaluation script for the Municipal Crowd-Report Verification System.
 *
 * Runs against the ACTUAL project database (SQLite via Prisma) — no fabricated
 * metrics. Usage:
 *
 *   bunx tsx scripts/evaluate.ts            # evaluate current DB
 *   bunx tsx scripts/evaluate.ts --reseed   # re-seed then evaluate
 *   bunx tsx scripts/evaluate.ts --json     # emit JSON only
 *
 * Produces:
 *   - Precision@10, Precision@20
 *   - Recall, F1
 *   - False positives, false negatives
 *   - High-priority detection rate
 *   - Verification accuracy
 *   - Freshness classification accuracy
 *   - Threshold sweep (confidence 0-100 step 10 → precision, recall, FP, FN)
 *   - Baseline (severity+recency) vs Proposed (verification engine) ranking
 *   - Latency
 *   - Per-incident ranking table
 *   - Error analysis (FP / FN list)
 *
 * Writes:
 *   scripts/evaluation_output.json   (machine-readable)
 *   docs/evaluation_results.md       (human-readable, overwrites)
 */

import { db } from "@/lib/db";
import {
  evaluateIncident,
  baselinePriorityScore,
  SEVERITY_SCORES,
} from "@/lib/verification-engine";
import {
  toReportType,
  toEvidenceType,
  toVerificationType,
  toIncidentType,
} from "@/lib/db-ops";
import { seedDatabase, SEED_SCENARIOS } from "@/lib/seed";
import { writeFileSync } from "fs";

const args = new Set(process.argv.slice(2));
const RESEED = args.has("--reseed");
const JSON_ONLY = args.has("--json");

interface EvalRow {
  incidentId: string;
  category: string;
  issueType: string;
  zone: string | null;
  reports: number;
  independentReports: number;
  duplicateReports: number;
  evidenceCount: number;
  verificationCount: number;
  baselineScore: number;
  proposedScore: number;
  confidenceScore: number;
  confidenceLevel: string;
  priorityLevel: string;
  status: string;
  freshness: string;
  groundTruthVerified: boolean;
  groundTruthCategory: string;
  latencyMs: number;
  hasExplanations: boolean;
}

function precisionAtK(ranked: EvalRow[], k: number): number {
  const top = ranked.slice(0, k);
  if (top.length === 0) return 0;
  return top.filter((r) => r.groundTruthVerified).length / top.length;
}

function recallAtK(ranked: EvalRow[], k: number, totalTrue: number): number {
  if (totalTrue === 0) return 0;
  const top = ranked.slice(0, k);
  return top.filter((r) => r.groundTruthVerified).length / totalTrue;
}

function f1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function main() {
  // Optionally re-seed for full reproducibility
  const stats = await db.incident.count();
  if (RESEED || stats === 0) {
    console.log(RESEED ? "Re-seeding database..." : "Database empty, seeding...");
    const result = await seedDatabase();
    console.log(
      `Seeded ${result.scenarios} scenarios, ${result.incidents} incidents, ${result.users} users.`
    );
  }

  const incidents = await db.incident.findMany({
    include: {
      incidentLinks: { include: { report: true } },
      evidence: true,
      responderVerifications: true,
    },
  });
  const labels = await db.evaluationLabel.findMany();
  const labelByReportId = new Map(labels.map((l) => [l.reportId, l]));

  const now = new Date();
  const rows: EvalRow[] = incidents.map((i) => {
    const reports = i.incidentLinks.map((l) => toReportType(l.report));
    const evidence = i.evidence.map(toEvidenceType);
    const verifications = i.responderVerifications.map(toVerificationType);
    const t0 = performance.now();
    const evaluation = evaluateIncident(reports, evidence, verifications, now);
    const latency = performance.now() - t0;
    const baseline = baselinePriorityScore(reports);
    const label = i.incidentLinks
      .map((l) => labelByReportId.get(l.report.id))
      .find((x) => x);
    const inc = toIncidentType(i);
    return {
      incidentId: inc.incidentId,
      category: inc.category,
      issueType: inc.issueType,
      zone: inc.zone,
      reports: reports.length,
      independentReports: evaluation.uniqueReports.length,
      duplicateReports: evaluation.duplicateReports.length,
      evidenceCount: evidence.length,
      verificationCount: verifications.length,
      baselineScore: Math.round(baseline),
      proposedScore: evaluation.priorityScore,
      confidenceScore: evaluation.confidenceScore,
      confidenceLevel: evaluation.confidenceLevel,
      priorityLevel: evaluation.priorityLevel,
      status: evaluation.status,
      freshness: evaluation.freshness,
      groundTruthVerified: label?.groundTruthVerified ?? false,
      groundTruthCategory: label?.groundTruthCategory ?? "normal",
      latencyMs: latency,
      hasExplanations:
        evaluation.confidenceExplanations.length > 0 ||
        evaluation.priorityExplanations.length > 0,
    };
  });

  // Rankings
  const baselineRanked = [...rows].sort((a, b) => {
    const sevA = Math.max(
      ...incidents
        .find((i) => i.incidentId === a.incidentId)!
        .incidentLinks.map((l) => SEVERITY_SCORES[l.report.citizenSeverity] ?? 10)
    );
    const sevB = Math.max(
      ...incidents
        .find((i) => i.incidentId === b.incidentId)!
        .incidentLinks.map((l) => SEVERITY_SCORES[l.report.citizenSeverity] ?? 10)
    );
    if (sevB !== sevA) return sevB - sevA;
    const tA = Math.max(
      ...incidents
        .find((i) => i.incidentId === a.incidentId)!
        .incidentLinks.map((l) => new Date(l.report.reportedTime).getTime())
    );
    const tB = Math.max(
      ...incidents
        .find((i) => i.incidentId === b.incidentId)!
        .incidentLinks.map((l) => new Date(l.report.reportedTime).getTime())
    );
    return tB - tA;
  });
  const proposedRanked = [...rows].sort((a, b) => b.proposedScore - a.proposedScore);

  const totalTrue = rows.filter((r) => r.groundTruthVerified).length;
  const totalFalse = rows.length - totalTrue;

  // Core metrics (proposed)
  const propP10 = precisionAtK(proposedRanked, 10);
  const propP20 = precisionAtK(proposedRanked, 20);
  const propRecall10 = recallAtK(proposedRanked, 10, totalTrue);
  const propRecall20 = recallAtK(proposedRanked, 20, totalTrue);
  const propF1_10 = f1(propP10, propRecall10);

  // Baseline
  const baseP10 = precisionAtK(baselineRanked, 10);
  const baseP20 = precisionAtK(baselineRanked, 20);
  const baseRecall20 = recallAtK(baselineRanked, 20, totalTrue);

  // Verification decision metrics (confidence >= 70 => "verified" positive)
  const decisionThreshold = 70;
  const systemPositive = rows.filter((r) => r.confidenceScore >= decisionThreshold);
  const tp = systemPositive.filter((r) => r.groundTruthVerified).length;
  const fp = systemPositive.filter((r) => !r.groundTruthVerified).length;
  const systemNegative = rows.filter((r) => r.confidenceScore < decisionThreshold);
  const fn = systemNegative.filter((r) => r.groundTruthVerified).length;
  const tn = systemNegative.filter((r) => !r.groundTruthVerified).length;
  const decisionPrecision = systemPositive.length > 0 ? tp / systemPositive.length : 0;
  const decisionRecall = totalTrue > 0 ? tp / totalTrue : 0;
  const decisionF1 = f1(decisionPrecision, decisionRecall);
  const decisionAccuracy = rows.length > 0 ? (tp + tn) / rows.length : 0;

  // Threshold sweep
  const thresholdSweep: Array<{
    threshold: number;
    tp: number;
    fp: number;
    fn: number;
    tn: number;
    precision: number;
    recall: number;
    f1: number;
  }> = [];
  for (let t = 0; t <= 100; t += 10) {
    const pos = rows.filter((r) => r.confidenceScore >= t);
    const neg = rows.filter((r) => r.confidenceScore < t);
    const stp = pos.filter((r) => r.groundTruthVerified).length;
    const sfp = pos.filter((r) => !r.groundTruthVerified).length;
    const sfn = neg.filter((r) => r.groundTruthVerified).length;
    const stn = neg.filter((r) => !r.groundTruthVerified).length;
    const sp = pos.length > 0 ? stp / pos.length : 0;
    const sr = totalTrue > 0 ? stp / totalTrue : 0;
    thresholdSweep.push({
      threshold: t,
      tp: stp,
      fp: sfp,
      fn: sfn,
      tn: stn,
      precision: sp,
      recall: sr,
      f1: f1(sp, sr),
    });
  }

  // Rank quality of true highs
  const trueRanks = proposedRanked
    .map((r, i) => ({ r, rank: i + 1 }))
    .filter((x) => x.r.groundTruthVerified)
    .map((x) => x.rank);
  const baseTrueRanks = baselineRanked
    .map((r, i) => ({ r, rank: i + 1 }))
    .filter((x) => x.r.groundTruthVerified)
    .map((x) => x.rank);

  // Latency
  const latencies = rows.map((r) => r.latencyMs);
  const totalLatencyMs = latencies.reduce((a, b) => a + b, 0);
  const avgLatencyMs = mean(latencies);
  const medianLatencyMs = median(latencies);

  // Explainability
  const explainabilityCount = rows.filter((r) => r.hasExplanations).length;
  const explainabilityPct = (explainabilityCount / Math.max(rows.length, 1)) * 100;

  // Freshness accuracy (engine freshness vs persisted freshness)
  const freshnessCorrect = rows.filter((r) => {
    const inc = incidents.find((i) => i.incidentId === r.incidentId)!;
    return inc.freshnessStatus === r.freshness;
  }).length;
  const freshnessAccuracy = (freshnessCorrect / Math.max(rows.length, 1)) * 100;

  // High-priority detection: ground-truth-high incidents ranked Critical/High
  const highPriDetected = rows.filter(
    (r) =>
      r.groundTruthVerified &&
      (r.priorityLevel === "Critical" || r.priorityLevel === "High")
  ).length;
  const highPriDetectionRate = totalTrue > 0 ? (highPriDetected / totalTrue) * 100 : 0;

  // Targets
  const targets = {
    p10: 0.8,
    p20: 0.75,
    recall: 0.8,
    f1: 0.8,
    latencyMs: 2000,
    explainability: 100,
    highPriDetection: 80,
  };

  const result = {
    generatedAt: now.toISOString(),
    dataset: {
      totalIncidents: rows.length,
      totalReports: rows.reduce((a, r) => a + r.reports, 0),
      groundTruthHigh: totalTrue,
      groundTruthLow: totalFalse,
      scenarios: SEED_SCENARIOS.length,
    },
    targets,
    baseline: {
      p10: baseP10,
      p20: baseP20,
      recall20: baseRecall20,
      meanRank: mean(baseTrueRanks),
      medianRank: median(baseTrueRanks),
    },
    proposed: {
      p10: propP10,
      p20: propP20,
      recall10: propRecall10,
      recall20: propRecall20,
      f1at10: propF1_10,
      meanRank: mean(trueRanks),
      medianRank: median(trueRanks),
      totalLatencyMs,
      avgLatencyMs,
      medianLatencyMs,
      explainabilityPct,
    },
    decision: {
      threshold: decisionThreshold,
      tp,
      fp,
      fn,
      tn,
      precision: decisionPrecision,
      recall: decisionRecall,
      f1: decisionF1,
      accuracy: decisionAccuracy,
      falsePositives: fp,
      falseNegatives: fn,
    },
    highPriDetectionRate,
    freshnessClassificationAccuracy: freshnessAccuracy,
    thresholdSweep,
    targetMet: {
      p10: propP10 >= targets.p10,
      p20: propP20 >= targets.p20,
      recall: propRecall20 >= targets.recall,
      f1: propF1_10 >= targets.f1,
      latency: totalLatencyMs <= targets.latencyMs,
      explainability: explainabilityPct >= targets.explainability,
      highPriDetection: highPriDetectionRate >= targets.highPriDetection,
    },
    perIncident: proposedRanked.map((r, i) => ({
      rank: i + 1,
      ...r,
    })),
    errorAnalysis: {
      falsePositives: proposedRanked
        .filter((r) => !r.groundTruthVerified && r.confidenceScore >= decisionThreshold)
        .map((r) => ({
          incidentId: r.incidentId,
          category: r.category,
          issueType: r.issueType,
          groundTruthCategory: r.groundTruthCategory,
          expectedState: "LOW_PRIORITY",
          predictedState: r.status,
          confidence: r.confidenceScore,
          priority: r.proposedScore,
          evidenceCount: r.evidenceCount,
          corroboration: r.independentReports,
          freshness: r.freshness,
          responderVerified: r.status === "Verified",
          reason: explainError(r, false),
        })),
      falseNegatives: proposedRanked
        .filter((r) => r.groundTruthVerified && r.confidenceScore < decisionThreshold)
        .map((r) => ({
          incidentId: r.incidentId,
          category: r.category,
          issueType: r.issueType,
          groundTruthCategory: r.groundTruthCategory,
          expectedState: "HIGH_PRIORITY",
          predictedState: r.status,
          confidence: r.confidenceScore,
          priority: r.proposedScore,
          evidenceCount: r.evidenceCount,
          corroboration: r.independentReports,
          freshness: r.freshness,
          responderVerified: r.status === "Verified",
          reason: explainError(r, true),
        })),
    },
  };

  // Write JSON output
  writeFileSync("scripts/evaluation_output.json", JSON.stringify(result, null, 2));

  if (JSON_ONLY) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable markdown output
  const md = `# Experimental Evaluation Results

> **Reproducible**: regenerate with \`bunx tsx scripts/evaluate.ts --reseed\`.
> Generated: ${result.generatedAt}
> Dataset: ${result.dataset.totalIncidents} incidents, ${result.dataset.totalReports} reports, ${result.dataset.groundTruthHigh} ground-truth-high, ${result.dataset.groundTruthLow} ground-truth-low.

## Methodology

The evaluation runs the **verification engine** against the reproducible simulated experiment (seeded in SQLite). Each incident is evaluated with the same rules used in production:

- **Freshness**: Fresh (≤24h), Aging (24–72h), Stale (>72h)
- **Duplicate detection**: same category + issue type, ≤25 m, ≤10 min
- **Confidence**: base 10 + corroboration (20 each, max 60) + evidence (15 + 15 HQ) − missing location (30) − conflicts (40); responder Verified → 100, Rejected → 0
- **Priority**: severity base + corroboration impact + confidence×0.2 + freshness penalty

**Ground truth** is assigned per scenario in \`src/lib/seed.ts\` (\`groundTruthVerified\`): true-high-priority incidents that should be surfaced, and false cases (duplicates, stale, conflicts, missing data, responder-rejected) that should NOT dominate the top of the queue.

## Baseline → Target → Measured

| Metric | Target | Baseline (severity+recency) | Prototype (verification engine) | Target met? |
|--------|--------|------------------------------|----------------------------------|-------------|
| Precision@10 | ≥ ${(targets.p10 * 100).toFixed(0)}% | ${(baseP10 * 100).toFixed(1)}% | ${(propP10 * 100).toFixed(1)}% | ${result.targetMet.p10 ? "Yes" : "No"} |
| Precision@20 | ≥ ${(targets.p20 * 100).toFixed(0)}% | ${(baseP20 * 100).toFixed(1)}% | ${(propP20 * 100).toFixed(1)}% | ${result.targetMet.p20 ? "Yes" : "No"} |
| Recall@20 | ≥ ${(targets.recall * 100).toFixed(0)}% | ${(baseRecall20 * 100).toFixed(1)}% | ${(propRecall20 * 100).toFixed(1)}% | ${result.targetMet.recall ? "Yes" : "No"} |
| F1@10 | ≥ ${(targets.f1 * 100).toFixed(0)}% | — | ${(propF1_10 * 100).toFixed(1)}% | ${result.targetMet.f1 ? "Yes" : "No"} |
| High-pri detection | ≥ ${targets.highPriDetection}% | — | ${highPriDetectionRate.toFixed(1)}% | ${result.targetMet.highPriDetection ? "Yes" : "No"} |
| Total latency | ≤ ${(targets.latencyMs / 1000).toFixed(1)}s | — | ${(totalLatencyMs / 1000).toFixed(4)}s | ${result.targetMet.latency ? "Yes" : "No"} |
| Explainability | 100% | — | ${explainabilityPct.toFixed(0)}% | ${result.targetMet.explainability ? "Yes" : "No"} |

## Verification Decision Metrics (confidence ≥ ${decisionThreshold} threshold)

| Metric | Value |
|--------|-------|
| True positives (TP) | ${tp} |
| False positives (FP) | ${fp} |
| False negatives (FN) | ${fn} |
| True negatives (TN) | ${tn} |
| Precision | ${(decisionPrecision * 100).toFixed(1)}% |
| Recall | ${(decisionRecall * 100).toFixed(1)}% |
| F1 | ${(decisionF1 * 100).toFixed(1)}% |
| Accuracy | ${(decisionAccuracy * 100).toFixed(1)}% |

## Precision–Recall Threshold Sweep

Confidence threshold sweep (0–100, step 10). The operational threshold of **${decisionThreshold}** is selected because it corresponds to the engine's definition of "High confidence" (≥70 = Corroborated), which is the documented decision boundary for surfacing incidents for field verification without requiring responder on-site confirmation.

| Threshold | TP | FP | FN | TN | Precision | Recall | F1 |
|-----------|----|----|----|----|-----------|--------|-----|
${thresholdSweep
  .map(
    (t) =>
      `| ${t.threshold} | ${t.tp} | ${t.fp} | ${t.fn} | ${t.tn} | ${(t.precision * 100).toFixed(1)}% | ${(t.recall * 100).toFixed(1)}% | ${(t.f1 * 100).toFixed(1)}% |`
  )
  .join("\n")}

## Ranking Quality

| | Baseline | Prototype |
|--|----------|-----------|
| Mean rank of true-high incidents | ${mean(baseTrueRanks).toFixed(1)} | ${mean(trueRanks).toFixed(1)} |
| Median rank of true-high incidents | ${median(baseTrueRanks).toFixed(1)} | ${median(trueRanks).toFixed(1)} |

## Latency

| | Value |
|--|-------|
| Total evaluation latency | ${(totalLatencyMs / 1000).toFixed(4)} s |
| Average per incident | ${avgLatencyMs.toFixed(4)} ms |
| Median per incident | ${medianLatencyMs.toFixed(4)} ms |

## Freshness Classification Accuracy

${freshnessAccuracy.toFixed(1)}% of incidents had their persisted freshness match the engine's recomputed freshness (consistency check).

## Per-Incident Ranking (Prototype)

| Rank | Incident | Category | Zone | GT | Baseline | Prototype | Conf | Status |
|------|----------|----------|------|----|----------|-----------|------|--------|
${proposedRanked
  .map(
    (r, i) =>
      `| ${i + 1} | ${r.incidentId} | ${r.category}/${r.issueType} | ${r.zone || "—"} | ${r.groundTruthVerified ? "HIGH" : r.groundTruthCategory} | ${r.baselineScore} | ${r.proposedScore} | ${r.confidenceScore} | ${r.status} |`
  )
  .join("\n")}

## Error Analysis

### False positives (ground-truth-low but confidence ≥ ${decisionThreshold})

${
  result.errorAnalysis.falsePositives.length === 0
    ? "None."
    : result.errorAnalysis.falsePositives
        .map(
          (f) =>
            `- \`${f.incidentId}\` — ${f.category}/${f.issueType} — expected ${f.expectedState}, predicted ${f.predictedState} — confidence ${f.confidence}, priority ${f.priority}, evidence ${f.evidenceCount}, corroboration ${f.corroboration}, freshness ${f.freshness}, responder ${f.responderVerified ? "yes" : "no"} — **reason**: ${f.reason}`
        )
        .join("\n")
}

### False negatives (ground-truth-high but confidence < ${decisionThreshold})

${
  result.errorAnalysis.falseNegatives.length === 0
    ? "None."
    : result.errorAnalysis.falseNegatives
        .map(
          (f) =>
            `- \`${f.incidentId}\` — ${f.category}/${f.issueType} — expected ${f.expectedState}, predicted ${f.predictedState} — confidence ${f.confidence}, priority ${f.priority}, evidence ${f.evidenceCount}, corroboration ${f.corroboration}, freshness ${f.freshness}, responder ${f.responderVerified ? "yes" : "no"} — **reason**: ${f.reason}`
        )
        .join("\n")
}

## Status

- **Baseline**: COMPLETE (severity + recency ranking)
- **Targets**: COMPLETE (documented in \`docs/evaluation_targets.md\`)
- **Validation dataset**: CREATED (${result.dataset.scenarios} reproducible scenarios in \`src/lib/seed.ts\`)
- **Ground truth**: CREATED (per-scenario \`groundTruthVerified\` label)
- **Experiment**: RUN (this script)
- **Results**: AVAILABLE (\`scripts/evaluation_output.json\`)
- **Error analysis**: AVAILABLE (above, with per-incident reasons)
- **Stakeholder validation**: PENDING REAL-WORLD VALIDATION (see \`docs/validation.md\`)
`;

  writeFileSync("docs/evaluation_results.md", md);
  console.log(md);
  console.log("\n✓ Written: scripts/evaluation_output.json, docs/evaluation_results.md");
}

function explainError(r: EvalRow, isFalseNegative: boolean): string {
  if (isFalseNegative) {
    const reasons: string[] = [];
    if (r.confidenceScore < 40)
      reasons.push(`low confidence (${r.confidenceScore}) due to insufficient corroboration or evidence`);
    if (r.evidenceCount === 0) reasons.push("no evidence attached");
    if (r.independentReports < 3)
      reasons.push(`only ${r.independentReports} independent report(s) — below corroboration threshold`);
    if (r.freshness !== "Fresh") reasons.push(`freshness is ${r.freshness}`);
    return reasons.length > 0
      ? reasons.join("; ")
      : "incident ranked below top-10 despite being ground-truth high";
  } else {
    const reasons: string[] = [];
    if (r.groundTruthCategory === "duplicate") reasons.push("duplicate reports not fully deduplicated");
    if (r.groundTruthCategory === "conflicting_evidence") reasons.push("conflicting evidence detected but incident still scored high");
    if (r.groundTruthCategory === "responder_rejected") reasons.push("responder rejected but ranking not fully suppressed");
    if (r.groundTruthCategory === "stale") reasons.push("stale report retained elevated priority");
    if (r.groundTruthCategory === "missing_location") reasons.push("missing location should have reduced priority further");
    return reasons.length > 0 ? reasons.join("; ") : "edge case retained elevated priority";
  }
}

main()
  .catch((e) => {
    console.error("Evaluation failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
