import { NextResponse } from "next/server";
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

/**
 * Live metrics endpoint that reproduces the evaluation methodology from
 * backend/scripts/evaluate_system.py:
 *   - baseline ranking (severity + recency)
 *   - proposed ranking (verification-engine priority)
 *   - Precision@10, Precision@20, High-priority recall, ranking quality,
 *     total latency, explainability coverage, freshness classification.
 * Ground truth is sourced from the EvaluationLabel table populated by the seed.
 */
export async function GET() {
  const incidents = await db.incident.findMany({
    include: {
      incidentLinks: { include: { report: true } },
      evidence: true,
      responderVerifications: true,
    },
  });

  const labels = await db.evaluationLabel.findMany();
  const labelByReportId = new Map(labels.map((l) => [l.reportId, l]));

  // Build evaluation list
  const now = new Date();
  const evalList = incidents.map((i) => {
    const reports = i.incidentLinks.map((l) => toReportType(l.report));
    const evidence = i.evidence.map(toEvidenceType);
    const verifications = i.responderVerifications.map(toVerificationType);
    const start = performance.now();
    const evaluation = evaluateIncident(reports, evidence, verifications, now);
    const latency = performance.now() - start;
    const baseline = baselinePriorityScore(reports);

    // Find ground truth label: any report in this incident that has a label.
    const label = i.incidentLinks
      .map((l) => labelByReportId.get(l.report.id))
      .find((x) => x);

    return {
      incident: toIncidentType(i),
      reports,
      evaluation,
      baselineScore: baseline,
      proposedScore: evaluation.priorityScore,
      latency,
      groundTruthVerified: label?.groundTruthVerified ?? false,
      groundTruthCategory: label?.groundTruthCategory ?? "normal",
      hasExplanations:
        evaluation.confidenceExplanations.length > 0 ||
        evaluation.priorityExplanations.length > 0,
      freshnessCorrect: i.freshnessStatus === evaluation.freshness,
    };
  });

  // Baseline ranking
  const baselineRanked = [...evalList].sort((a, b) => {
    // severity desc, then recency desc
    const sevA = Math.max(...a.reports.map((r) => SEVERITY_SCORES[r.citizenSeverity] ?? 10));
    const sevB = Math.max(...b.reports.map((r) => SEVERITY_SCORES[r.citizenSeverity] ?? 10));
    if (sevB !== sevA) return sevB - sevA;
    const timeA = Math.max(...a.reports.map((r) => new Date(r.reportedTime).getTime()));
    const timeB = Math.max(...b.reports.map((r) => new Date(r.reportedTime).getTime()));
    return timeB - timeA;
  });

  // Proposed ranking
  const proposedRanked = [...evalList].sort(
    (a, b) => b.proposedScore - a.proposedScore
  );

  const totalTrueHigh = evalList.filter((e) => e.groundTruthVerified).length;

  function precisionAt(ranked: typeof evalList, k: number) {
    const top = ranked.slice(0, k);
    if (top.length === 0) return 0;
    return top.filter((e) => e.groundTruthVerified).length / top.length;
  }
  function recallAt(ranked: typeof evalList, k: number) {
    const top = ranked.slice(0, k);
    return totalTrueHigh > 0
      ? top.filter((e) => e.groundTruthVerified).length / totalTrueHigh
      : 0;
  }
  function rankOfTrueHighs(ranked: typeof evalList) {
    const ranks: number[] = [];
    ranked.forEach((e, idx) => {
      if (e.groundTruthVerified) ranks.push(idx + 1);
    });
    if (ranks.length === 0) return { mean: 0, median: 0 };
    const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    const sorted = [...ranks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { mean, median };
  }

  const baseP10 = precisionAt(baselineRanked, 10);
  const baseP20 = precisionAt(baselineRanked, 20);
  const propP10 = precisionAt(proposedRanked, 10);
  const propP20 = precisionAt(proposedRanked, 20);
  const baseRecall = recallAt(baselineRanked, 20);
  const propRecall = recallAt(proposedRanked, 20);
  const baseRank = rankOfTrueHighs(baselineRanked);
  const propRank = rankOfTrueHighs(proposedRanked);
  const totalLatency = evalList.reduce((a, b) => a + b.latency, 0);
  const avgLatency = totalLatency / Math.max(evalList.length, 1);
  const explainabilityCount = evalList.filter((e) => e.hasExplanations).length;
  const explainabilityPerc =
    (explainabilityCount / Math.max(evalList.length, 1)) * 100;
  const freshnessCorrectCount = evalList.filter((e) => e.freshnessCorrect).length;
  const freshnessAccuracy =
    (freshnessCorrectCount / Math.max(evalList.length, 1)) * 100;

  // Verification accuracy: incidents the system calls Verified/Corroborated vs ground truth
  const systemVerified = evalList.filter((e) =>
    ["Verified", "Corroborated"].includes(e.evaluation.status)
  );
  const correctlyVerified = systemVerified.filter(
    (e) => e.groundTruthVerified
  ).length;
  const incorrectlyVerified = systemVerified.filter(
    (e) => !e.groundTruthVerified
  ).length;
  const falsePositives = incorrectlyVerified;
  // False negatives: ground-truth high that the system did NOT mark verified/corroborated
  const falseNegatives = evalList.filter(
    (e) =>
      e.groundTruthVerified &&
      !["Verified", "Corroborated"].includes(e.evaluation.status)
  ).length;
  const verificationAccuracy =
    systemVerified.length > 0
      ? (correctlyVerified / systemVerified.length) * 100
      : 0;

  // Median verification time (simulated: time from first report to responder verified)
  const verifiedTimes: number[] = [];
  for (const e of evalList) {
    if (e.evaluation.status === "Verified") {
      const firstReport = e.reports
        .map((r) => new Date(r.reportedTime).getTime())
        .sort()[0];
      const v = e.incident;
      // use updatedAt as a proxy for verified time
      const verifiedAt = new Date(v.updatedAt).getTime();
      if (verifiedAt > firstReport) {
        verifiedTimes.push((verifiedAt - firstReport) / 1000); // seconds
      }
    }
  }
  verifiedTimes.sort((a, b) => a - b);
  const medianVerificationTime =
    verifiedTimes.length > 0
      ? verifiedTimes[Math.floor(verifiedTimes.length / 2)]
      : 0;

  // Confidence calibration: bucket by confidence level and check precision
  const calibrationBuckets = ["Low", "Medium", "High"].map((bucket) => {
    const inBucket = evalList.filter((e) => e.evaluation.confidenceLevel === bucket);
    const trueHighInBucket = inBucket.filter((e) => e.groundTruthVerified).length;
    return {
      bucket,
      count: inBucket.length,
      actualHighPct:
        inBucket.length > 0 ? (trueHighInBucket / inBucket.length) * 100 : 0,
    };
  });

  const highPriorityDetectionRate =
    totalTrueHigh > 0
      ? (evalList.filter(
          (e) =>
            e.groundTruthVerified &&
            (e.evaluation.priorityLevel === "Critical" ||
              e.evaluation.priorityLevel === "High")
        ).length /
        totalTrueHigh) *
        100
      : 0;

  const targets = {
    p10: 80,
    p20: 75,
    recall: 80,
    latencyMs: 2000,
    explainability: 100,
  };

  return NextResponse.json({
    summary: {
      totalReports: evalList.reduce((a, e) => a + e.reports.length, 0),
      totalIncidents: evalList.length,
      verifiedIncidents: evalList.filter((e) => e.evaluation.status === "Verified").length,
      incorrectlyVerifiedReports: incorrectlyVerified,
      falsePositives,
      falseNegatives,
      highPriorityDetectionRate,
      verificationAccuracy,
      medianVerificationTimeSec: medianVerificationTime,
      freshnessClassificationAccuracy: freshnessAccuracy,
      confidenceCalibration: calibrationBuckets,
    },
    baseline: {
      p10: baseP10,
      p20: baseP20,
      recall: baseRecall,
      meanRank: baseRank.mean,
      medianRank: baseRank.median,
    },
    proposed: {
      p10: propP10,
      p20: propP20,
      recall: propRecall,
      meanRank: propRank.mean,
      medianRank: propRank.median,
      totalLatencyMs: totalLatency,
      avgLatencyMs: avgLatency,
      explainabilityPct: explainabilityPerc,
    },
    targets,
    targetMet: {
      p10: propP10 * 100 >= targets.p10,
      p20: propP20 * 100 >= targets.p20,
      recall: propRecall * 100 >= targets.recall,
      latency: totalLatency <= targets.latencyMs / 1000,
      explainability: explainabilityPerc >= targets.explainability,
    },
    perIncident: proposedRanked.map((e, idx) => ({
      rank: idx + 1,
      incidentId: e.incident.incidentId,
      label: e.incident.category + " / " + e.incident.issueType,
      zone: e.incident.zone,
      groundTruthVerified: e.groundTruthVerified,
      groundTruthCategory: e.groundTruthCategory,
      baselineScore: Math.round(e.baselineScore),
      proposedScore: e.proposedScore,
      confidenceScore: e.evaluation.confidenceScore,
      status: e.evaluation.status,
      freshness: e.evaluation.freshness,
      operationalStates: e.evaluation.operationalStates,
    })),
    errorAnalysis: {
      falsePositives: proposedRanked
        .filter((e) => !e.groundTruthVerified && e.evaluation.status !== "Rejected")
        .slice(0, 5)
        .map((e) => ({
          incidentId: e.incident.incidentId,
          category: e.groundTruthCategory,
          status: e.evaluation.status,
          confidence: e.evaluation.confidenceScore,
        })),
      falseNegatives: proposedRanked
        .filter((e) => e.groundTruthVerified && e.evaluation.priorityScore < 60)
        .slice(0, 5)
        .map((e) => ({
          incidentId: e.incident.incidentId,
          status: e.evaluation.status,
          confidence: e.evaluation.confidenceScore,
        })),
    },
  });
}
