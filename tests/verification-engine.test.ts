/**
 * Verification engine tests — TypeScript port of the original Python tests.
 * Run with: bun test (or bunx vitest) — these are pure-function assertions.
 *
 * Covers: normal verification, duplicate reports, stale reports, missing
 * location, conflicting evidence, missing evidence, high-priority detection,
 * confidence calculation, and the operational-state surfacing.
 */

import {
  evaluateIncident,
  haversineDistanceMeters,
  calculateConfidence,
  determineOperationalStates,
  baselinePriorityScore,
} from "@/lib/verification-engine";
import type { Report, ExternalEvidence, ResponderVerification } from "@/lib/types";

function mkReport(p: Partial<Report>): Report {
  return {
    id: p.id || "r1",
    reportId: p.reportId || "RPT-1",
    category: p.category || "Roads",
    issueType: p.issueType || "pothole",
    description: p.description || "",
    zone: p.zone || "Central Zone",
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    reportedTime: p.reportedTime || new Date(),
    citizenSeverity: p.citizenSeverity || "High",
    citizenName: p.citizenName || "Citizen",
    corroboratingReports: 0,
    locationStatus: p.locationStatus || "Available",
    freshnessStatus: p.freshnessStatus || "Fresh",
    conflictingEvidence: p.conflictingEvidence || "no",
    createdAt: new Date(),
  };
}

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function approx(a: number, b: number, eps = 1) {
  return Math.abs(a - b) <= eps;
}

const now = new Date("2025-06-01T12:00:00Z");

console.log("\n=== Verification Engine Tests ===\n");

// 1. Normal corroboration
console.log("Test 1: Normal corroboration raises confidence");
{
  // Reports ~50-100m apart: independent corroborating reports (not duplicates)
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.61, longitude: 77.21, reportedTime: new Date(now.getTime() - 30 * 60000), citizenSeverity: "Critical" }),
    mkReport({ id: "r2", latitude: 28.6105, longitude: 77.2105, reportedTime: new Date(now.getTime() - 25 * 60000) }),
    mkReport({ id: "r3", latitude: 28.611, longitude: 77.211, reportedTime: new Date(now.getTime() - 20 * 60000) }),
  ];
  const ev: ExternalEvidence[] = [
    { id: "e1", evidenceId: "EVD-1", incidentId: "inc1", sourceType: "Citizen photo", sourceStatus: "High Quality", observedAt: new Date(now.getTime() - 28 * 60000), createdAt: new Date() },
  ];
  const ver: ResponderVerification[] = [];
  const r = evaluateIncident(reports, ev, ver, now);
  assert(r.confidenceScore >= 70, `confidence >= 70 (got ${r.confidenceScore})`);
  assert(r.status === "Corroborated", `status Corroborated (got ${r.status})`);
  assert(r.uniqueReports.length === 3, `3 unique reports (got ${r.uniqueReports.length})`);
  assert(r.confidenceBreakdown.length >= 4, "breakdown has >= 4 items");
}

// 2. Duplicate reports are deduplicated
console.log("\nTest 2: Duplicate reports are filtered");
{
  const base = { latitude: 28.6139, longitude: 77.209, category: "Roads", issueType: "pothole" };
  const t = now.getTime();
  const reports: Report[] = Array.from({ length: 10 }, (_, i) =>
    mkReport({ id: `r${i}`, ...base, reportedTime: new Date(t - (10 - i) * 30000), citizenSeverity: "Critical", description: "Terrible pothole" })
  );
  const r = evaluateIncident(reports, [], [], now);
  assert(r.uniqueReports.length === 1, `1 unique after dedup (got ${r.uniqueReports.length})`);
  assert(r.duplicateReports.length === 9, `9 duplicates filtered (got ${r.duplicateReports.length})`);
  assert(r.confidenceScore < 70, `duplicate spam does NOT reach high confidence (got ${r.confidenceScore})`);
}

// 3. Stale report
console.log("\nTest 3: Stale report reduces priority");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.6, longitude: 77.2, reportedTime: new Date(now.getTime() - 5 * 24 * 60 * 60000), citizenSeverity: "Critical" }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  assert(r.freshness === "Stale", `freshness Stale (got ${r.freshness})`);
  assert(r.operationalStates.includes("STALE"), "STALE operational state surfaced");
  assert(r.priorityScore < 70, `stale critical priority < 70 (got ${r.priorityScore})`);
}

// 4. Missing location penalises confidence
console.log("\nTest 4: Missing location penalises confidence");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: null, longitude: null, citizenSeverity: "Critical", reportedTime: new Date(now.getTime() - 10 * 60000) }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  assert(r.confidenceScore <= 10, `missing loc confidence <= 10 (got ${r.confidenceScore})`);
  assert(r.operationalStates.includes("MISSING_LOCATION"), "MISSING_LOCATION surfaced");
}

// 5. Conflicting evidence drops confidence and status
console.log("\nTest 5: Conflicting evidence");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.612, longitude: 77.182, reportedTime: new Date(now.getTime() - 25 * 60000), citizenSeverity: "Critical", conflictingEvidence: "yes" }),
    mkReport({ id: "r2", latitude: 28.6121, longitude: 77.1821, reportedTime: new Date(now.getTime() - 22 * 60000), citizenSeverity: "Low", conflictingEvidence: "yes" }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  assert(r.status === "Conflicted", `status Conflicted (got ${r.status})`);
  assert(r.operationalStates.includes("CONFLICTING_EVIDENCE"), "CONFLICTING_EVIDENCE surfaced");
  assert(r.confidenceScore < 40, `conflict confidence < 40 (got ${r.confidenceScore})`);
}

// 6. Missing evidence / insufficient data
console.log("\nTest 6: Missing evidence");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: null, longitude: null, citizenSeverity: "Medium", reportedTime: new Date(now.getTime() - 70 * 60000) }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  assert(r.operationalStates.includes("MISSING_EVIDENCE"), "MISSING_EVIDENCE surfaced");
  assert(r.operationalStates.includes("INSUFFICIENT_DATA"), "INSUFFICIENT_DATA surfaced");
}

// 7. Responder verified forces confidence to 100
console.log("\nTest 7: Responder verification overrides");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.62, longitude: 77.21, reportedTime: new Date(now.getTime() - 60 * 60000), citizenSeverity: "High" }),
  ];
  const ver: ResponderVerification[] = [
    { id: "v1", incidentId: "inc1", responderName: "Officer", verificationStatus: "Verified", verifiedAt: new Date(), createdAt: new Date() },
  ];
  const r = evaluateIncident(reports, [], ver, now);
  assert(r.confidenceScore === 100, `verified confidence = 100 (got ${r.confidenceScore})`);
  assert(r.status === "Verified", `status Verified (got ${r.status})`);
  assert(r.operationalStates.includes("VERIFIED"), "VERIFIED surfaced");
}

// 8. Responder rejected forces confidence to 0
console.log("\nTest 8: Responder rejection");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.595, longitude: 77.265, reportedTime: new Date(now.getTime() - 40 * 60000), citizenSeverity: "Critical" }),
  ];
  const ver: ResponderVerification[] = [
    { id: "v1", incidentId: "inc1", responderName: "Officer", verificationStatus: "Rejected", verifiedAt: new Date(), createdAt: new Date() },
  ];
  const r = evaluateIncident(reports, [], ver, now);
  assert(r.confidenceScore === 0, `rejected confidence = 0 (got ${r.confidenceScore})`);
  assert(r.status === "Rejected", `status Rejected (got ${r.status})`);
}

// 9. High-priority detection
console.log("\nTest 9: High-priority detection");
{
  // Reports ~50-100m apart so they are independent corroborating reports
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.65, longitude: 77.22, reportedTime: new Date(now.getTime() - 15 * 60000), citizenSeverity: "Critical" }),
    mkReport({ id: "r2", latitude: 28.6505, longitude: 77.2205, reportedTime: new Date(now.getTime() - 12 * 60000), citizenSeverity: "Critical" }),
    mkReport({ id: "r3", latitude: 28.651, longitude: 77.221, reportedTime: new Date(now.getTime() - 10 * 60000), citizenSeverity: "High" }),
  ];
  const ev: ExternalEvidence[] = [
    { id: "e1", evidenceId: "EVD-1", incidentId: "inc1", sourceType: "Citizen photo", sourceStatus: "High Quality", observedAt: new Date(now.getTime() - 14 * 60000), createdAt: new Date() },
  ];
  const r = evaluateIncident(reports, ev, [], now);
  assert(r.priorityLevel === "Critical", `priority Critical (got ${r.priorityLevel})`);
  assert(r.priorityScore >= 80, `priority score >= 80 (got ${r.priorityScore})`);
  assert(r.operationalStates.includes("HIGH_PRIORITY"), "HIGH_PRIORITY surfaced");
}

// 10. Haversine distance sanity
console.log("\nTest 10: Haversine distance");
{
  const d = haversineDistanceMeters(28.6139, 77.209, 28.6139, 77.209);
  assert(d === 0, "same point = 0m");
  const d2 = haversineDistanceMeters(28.6139, 77.209, 28.6140, 77.2091);
  assert(d2 > 5 && d2 < 25, `nearby point within 5-25m (got ${d2.toFixed(1)}m)`);
}

// 11. Baseline vs proposed ranking sanity
console.log("\nTest 11: Baseline ranking uses severity");
{
  const lowReports = [mkReport({ citizenSeverity: "Low", reportedTime: new Date(now.getTime() - 10 * 60000) })];
  const critReports = [mkReport({ citizenSeverity: "Critical", reportedTime: new Date(now.getTime() - 10 * 60000) })];
  const baseLow = baselinePriorityScore(lowReports);
  const baseCrit = baselinePriorityScore(critReports);
  assert(baseCrit > baseLow, `critical baseline > low baseline (${baseCrit} > ${baseLow})`);
}

// 12. Evidence boosts confidence
console.log("\nTest 12: Evidence boosts confidence");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.6, longitude: 77.2, reportedTime: new Date(now.getTime() - 30 * 60000), citizenSeverity: "High" }),
  ];
  const noEv = evaluateIncident(reports, [], [], now);
  const withEv = evaluateIncident(reports, [
    { id: "e1", evidenceId: "EVD-1", incidentId: "inc1", sourceType: "Photo", sourceStatus: "High Quality", observedAt: new Date(now.getTime() - 28 * 60000), createdAt: new Date() },
  ], [], now);
  assert(withEv.confidenceScore > noEv.confidenceScore, `evidence raises confidence (${withEv.confidenceScore} > ${noEv.confidenceScore})`);
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
