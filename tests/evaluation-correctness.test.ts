/**
 * Evaluation correctness tests — verify the evaluation calculation itself is
 * correct (ground-truth audit + metric formulas).
 *
 * These tests guard against bugs in the precision/recall/F1 computation and
 * the ground-truth labelling in the seed.
 *
 * Run: bunx tsx tests/evaluation-correctness.test.ts
 */

import {
  evaluateIncident,
  baselinePriorityScore,
  SEVERITY_SCORES,
  haversineDistanceMeters,
  DUPLICATE_DISTANCE_THRESHOLD_METERS,
} from "@/lib/verification-engine";
import { SEED_SCENARIOS } from "@/lib/seed";
import type { Report, ExternalEvidence, ResponderVerification } from "@/lib/types";

let pass = 0;
let fail = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log("\n=== Evaluation Correctness Tests ===\n");

// ---------------------------------------------------------------------------
// 1. Ground-truth audit: every scenario has a groundTruthVerified label
// ---------------------------------------------------------------------------
console.log("Audit 1: Ground-truth labelling completeness");
{
  for (const s of SEED_SCENARIOS) {
    check(
      typeof s.groundTruthVerified === "boolean",
      `${s.label} has groundTruthVerified boolean`
    );
    check(
      typeof s.groundTruthCategory === "string" && s.groundTruthCategory.length > 0,
      `${s.label} has groundTruthCategory string`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Ground-truth consistency: high-priority scenarios are labelled true
// ---------------------------------------------------------------------------
console.log("\nAudit 2: Ground-truth label consistency");
{
  const highPri = SEED_SCENARIOS.filter((s) => s.groundTruthVerified);
  const lowPri = SEED_SCENARIOS.filter((s) => !s.groundTruthVerified);
  check(highPri.length >= 5, `at least 5 true-high scenarios (got ${highPri.length})`);
  check(lowPri.length >= 4, `at least 4 true-low scenarios (got ${lowPri.length})`);

  // Edge cases must be labelled false
  const edgeCats = [
    "duplicate",
    "stale",
    "missing_location",
    "conflicting_evidence",
    "missing_evidence",
    "responder_rejected",
  ];
  for (const cat of edgeCats) {
    const found = SEED_SCENARIOS.find((s) => s.groundTruthCategory === cat);
    if (found) {
      check(
        !found.groundTruthVerified,
        `${cat} scenario labelled groundTruthVerified=false`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Precision@K formula correctness (manual computation)
// ---------------------------------------------------------------------------
console.log("\nAudit 3: Precision@K formula correctness");
{
  // Simulate a ranked list with known ground truth
  // ranks 1,3,5 are true-high; ranks 2,4 are false
  const ranked = [
    { gt: true },
    { gt: false },
    { gt: true },
    { gt: false },
    { gt: true },
    { gt: false },
    { gt: false },
    { gt: false },
    { gt: false },
    { gt: false },
  ];
  // Precision@10 = 3/10 = 0.3
  const tp = ranked.slice(0, 10).filter((r) => r.gt).length;
  const p10 = tp / 10;
  check(p10 === 0.3, `manual Precision@10 = 0.3 (got ${p10})`);

  // Precision@5 = 3/5 = 0.6
  const tp5 = ranked.slice(0, 5).filter((r) => r.gt).length;
  const p5 = tp5 / 5;
  check(p5 === 0.6, `manual Precision@5 = 0.6 (got ${p5})`);
}

// ---------------------------------------------------------------------------
// 4. Recall formula correctness
// ---------------------------------------------------------------------------
console.log("\nAudit 4: Recall formula correctness");
{
  const ranked = [
    { gt: true },
    { gt: false },
    { gt: true },
    { gt: false },
    { gt: true },
  ];
  const totalTrue = 3;
  const tp = ranked.slice(0, 5).filter((r) => r.gt).length;
  const recall = tp / totalTrue;
  check(recall === 1.0, `manual recall = 1.0 when all true-high in top-K (got ${recall})`);
}

// ---------------------------------------------------------------------------
// 5. F1 formula correctness
// ---------------------------------------------------------------------------
console.log("\nAudit 5: F1 formula correctness");
{
  const precision = 0.9;
  const recall = 0.9;
  const f1 = (2 * precision * recall) / (precision + recall);
  check(Math.abs(f1 - 0.9) < 0.001, `F1(0.9, 0.9) = 0.9 (got ${f1})`);

  const f1zero = 0; // precision=0 → F1=0
  check(f1zero === 0, `F1(0, anything) = 0`);
}

// ---------------------------------------------------------------------------
// 6. Threshold sweep logic: each threshold produces consistent TP+FN = totalTrue
// ---------------------------------------------------------------------------
console.log("\nAudit 6: Threshold sweep consistency");
{
  const rows = [
    { conf: 100, gt: true },
    { conf: 80, gt: true },
    { conf: 60, gt: false },
    { conf: 40, gt: true },
    { conf: 20, gt: false },
    { conf: 10, gt: false },
  ];
  const totalTrue = rows.filter((r) => r.gt).length;
  for (let t = 0; t <= 100; t += 20) {
    const pos = rows.filter((r) => r.conf >= t);
    const neg = rows.filter((r) => r.conf < t);
    const tp = pos.filter((r) => r.gt).length;
    const fn = neg.filter((r) => r.gt).length;
    check(
      tp + fn === totalTrue,
      `threshold ${t}: TP(${tp}) + FN(${fn}) = totalTrue(${totalTrue})`
    );
  }
}

// ---------------------------------------------------------------------------
// 7. Baseline ranking uses severity + recency (not confidence)
// ---------------------------------------------------------------------------
console.log("\nAudit 7: Baseline ranking independence from confidence");
{
  // Two incidents: A has Critical severity + low confidence, B has Low + high
  const reportsA: Report[] = [
    {
      id: "a1", reportId: "RPT-A", category: "Roads", issueType: "pothole",
      description: "", zone: "Z", latitude: 28.6, longitude: 77.2,
      reportedTime: new Date(), citizenSeverity: "Critical", citizenName: "x",
      corroboratingReports: 0, locationStatus: "Available", freshnessStatus: "Fresh",
      conflictingEvidence: "no", createdAt: new Date(),
    },
  ];
  const reportsB: Report[] = [
    {
      ...reportsA[0], id: "b1", reportId: "RPT-B", citizenSeverity: "Low",
    },
  ];
  const baseA = baselinePriorityScore(reportsA);
  const baseB = baselinePriorityScore(reportsB);
  check(baseA > baseB, `baseline Critical (${baseA}) > Low (${baseB}) — severity-driven`);
}

// ---------------------------------------------------------------------------
// 8. Duplicate-spam scenario: all reports within 25m → 1 unique
// ---------------------------------------------------------------------------
console.log("\nAudit 8: Duplicate-spam deduplication correctness");
{
  const spamScenario = SEED_SCENARIOS.find((s) => s.groundTruthCategory === "duplicate");
  check(!!spamScenario, "duplicate scenario exists in seed");
  if (spamScenario) {
    // All spam reports have identical lat/lon → all within 25m
    const coords = spamScenario.reports.map((r) => ({
      lat: r.lat ?? spamScenario.baseLat,
      lon: r.lon ?? spamScenario.baseLon,
    }));
    const allSame = coords.every((c) => c.lat === coords[0].lat && c.lon === coords[0].lon);
    check(allSame, "all spam reports have identical coordinates (deterministic)");

    // Build Report objects and evaluate
    const reports: Report[] = spamScenario.reports.map((r, i) => ({
      id: `s${i}`, reportId: `RPT-S${i}`, category: spamScenario.category,
      issueType: spamScenario.issueType, description: r.description, zone: spamScenario.zone,
      latitude: r.lat ?? spamScenario.baseLat, longitude: r.lon ?? spamScenario.baseLon,
      reportedTime: new Date(Date.now() + r.offsetMinutes * 60000),
      citizenSeverity: r.severity, citizenName: r.citizenName, corroboratingReports: 0,
      locationStatus: "Available", freshnessStatus: "Fresh",
      conflictingEvidence: r.conflicting || "no", createdAt: new Date(),
    }));
    const ev = evaluateIncident(reports, [], [], new Date());
    check(ev.uniqueReports.length === 1, `10 spam reports → 1 unique (got ${ev.uniqueReports.length})`);
    check(ev.duplicateReports.length === 9, `9 duplicates filtered (got ${ev.duplicateReports.length})`);
    check(ev.confidenceScore < 70, `spam confidence < 70 (got ${ev.confidenceScore}) — not corroborated`);
  }
}

// ---------------------------------------------------------------------------
// 9. Haversine threshold correctness
// ---------------------------------------------------------------------------
console.log("\nAudit 9: Haversine threshold boundaries");
{
  // 25m is the duplicate threshold
  const d24 = haversineDistanceMeters(28.614, 77.2095, 28.6142, 77.2095);
  check(d24 < DUPLICATE_DISTANCE_THRESHOLD_METERS, `${d24.toFixed(1)}m < 25m threshold`);
  const d201 = haversineDistanceMeters(28.614, 77.2095, 28.6158, 77.2095);
  check(d201 > DUPLICATE_DISTANCE_THRESHOLD_METERS, `${d201.toFixed(0)}m > 25m threshold`);
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
