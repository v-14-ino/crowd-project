/**
 * Failure-scenario tests for the Crowd-Report Verification System.
 *
 * Each test exercises an edge/failure case end-to-end:
 *   input → system behavior → state → dashboard representation → expected action
 *
 * Run: bunx tsx tests/failure-scenarios.test.ts
 */

import {
  evaluateIncident,
  haversineDistanceMeters,
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

function mkEvidence(p: Partial<ExternalEvidence>): ExternalEvidence {
  return {
    id: p.id || "e1",
    evidenceId: p.evidenceId || "EVD-1",
    incidentId: p.incidentId || "inc1",
    reportId: null,
    sourceType: p.sourceType || "Citizen photo",
    sourceStatus: p.sourceStatus || "Standard",
    observedAt: p.observedAt || new Date(),
    freshnessStatus: "Fresh",
    details: p.details || "",
    fileName: null,
    fileUrl: null,
    fileSize: null,
    mimeType: null,
    latitude: null,
    longitude: null,
    createdAt: new Date(),
  };
}

function mkVerification(p: Partial<ResponderVerification>): ResponderVerification {
  return {
    id: p.id || "v1",
    incidentId: p.incidentId || "inc1",
    responderId: null,
    responderName: p.responderName || "Officer",
    verificationStatus: p.verificationStatus || "Verified",
    notes: p.notes || null,
    verifiedAt: p.verifiedAt || new Date(),
    createdAt: new Date(),
  };
}

const now = new Date("2025-06-01T12:00:00Z");
const mins = (m: number) => new Date(now.getTime() + m * 60 * 1000);

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

console.log("\n=== Failure Scenario Tests ===\n");

// ---------------------------------------------------------------------------
// CASE 1: Duplicate citizen reports
// Input: 10 Critical reports of same pothole, same location, within minutes
// System behavior: deduplication filters 9 as duplicates
// State: confidence stays low (1 independent report)
// Dashboard: duplicate count shown, priority not artificially inflated
// Expected action: monitor, do not over-prioritise
// ---------------------------------------------------------------------------
console.log("Case 1: Duplicate citizen reports");
{
  const reports: Report[] = Array.from({ length: 10 }, (_, i) =>
    mkReport({
      id: `r${i}`,
      latitude: 28.614,
      longitude: 77.209,
      reportedTime: mins(-10 + i * 0.5),
      citizenSeverity: "Critical",
      description: "Terrible pothole here",
      citizenName: `Spammer ${i + 1}`,
    })
  );
  const r = evaluateIncident(reports, [], [], now);
  check(r.uniqueReports.length === 1, `1 unique after dedup (got ${r.uniqueReports.length})`);
  check(r.duplicateReports.length === 9, `9 duplicates filtered (got ${r.duplicateReports.length})`);
  check(r.confidenceScore < 70, `confidence not inflated by spam (got ${r.confidenceScore})`);
  check(!r.operationalStates.includes("VERIFIED"), "not auto-verified from spam");
}

// ---------------------------------------------------------------------------
// CASE 2: Stale report
// Input: Critical report 5 days old, no recent corroboration
// System behavior: freshness = Stale, priority penalty -30
// State: STALE
// Dashboard: STALE badge, reduced priority
// Expected action: recommend re-verification
// ---------------------------------------------------------------------------
console.log("\nCase 2: Stale report");
{
  const reports: Report[] = [
    mkReport({
      latitude: 28.582,
      longitude: 77.195,
      reportedTime: mins(-5 * 24 * 60),
      citizenSeverity: "Critical",
    }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  check(r.freshness === "Stale", `freshness Stale (got ${r.freshness})`);
  check(r.operationalStates.includes("STALE"), "STALE state surfaced");
  check(r.priorityScore < 70, `stale priority < 70 (got ${r.priorityScore})`);
  check(
    r.recommendedAction.toLowerCase().includes("stale") || r.recommendedAction.toLowerCase().includes("re-verification"),
    `recommended action mentions stale/re-verification`
  );
}

// ---------------------------------------------------------------------------
// CASE 3: Missing location
// Input: Critical report with no GPS coordinates
// System behavior: confidence penalty -30, MISSING_LOCATION state
// State: MISSING_LOCATION, INSUFFICIENT_DATA (no evidence + no loc)
// Dashboard: MISSING_LOCATION badge, confidence reduced
// Expected action: request precise coordinates from citizen
// ---------------------------------------------------------------------------
console.log("\nCase 3: Missing location");
{
  const reports: Report[] = [
    mkReport({
      latitude: null,
      longitude: null,
      citizenSeverity: "Critical",
      reportedTime: mins(-35),
    }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  check(r.confidenceScore <= 10, `confidence <= 10 (got ${r.confidenceScore})`);
  check(r.operationalStates.includes("MISSING_LOCATION"), "MISSING_LOCATION surfaced");
  check(r.operationalStates.includes("INSUFFICIENT_DATA"), "INSUFFICIENT_DATA surfaced");
  check(
    r.recommendedAction.toLowerCase().includes("location") || r.recommendedAction.toLowerCase().includes("coordinates"),
    "recommended action requests location"
  );
}

// ---------------------------------------------------------------------------
// CASE 4: Conflicting evidence
// Input: 2 reports disagree (Critical vs Low, conflicting=yes)
// System behavior: conflict penalty -40, status Conflicted
// State: CONFLICTING_EVIDENCE, confidence 0
// Dashboard: CONFLICTING_EVIDENCE badge, NOT auto-verified
// Expected action: manual verification required
// ---------------------------------------------------------------------------
console.log("\nCase 4: Conflicting evidence");
{
  const reports: Report[] = [
    mkReport({
      latitude: 28.612,
      longitude: 77.182,
      reportedTime: mins(-25),
      citizenSeverity: "Critical",
      conflictingEvidence: "yes",
      description: "Huge dangerous pothole",
    }),
    mkReport({
      id: "r2",
      latitude: 28.6121,
      longitude: 77.1821,
      reportedTime: mins(-22),
      citizenSeverity: "Low",
      conflictingEvidence: "yes",
      description: "Just a small crack",
    }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  check(r.status === "Conflicted", `status Conflicted (got ${r.status})`);
  check(r.operationalStates.includes("CONFLICTING_EVIDENCE"), "CONFLICTING_EVIDENCE surfaced");
  check(r.confidenceScore < 40, `confidence < 40 (got ${r.confidenceScore})`);
  check(!r.operationalStates.includes("VERIFIED"), "NOT auto-verified despite Critical severity");
  check(r.recommendedAction.toLowerCase().includes("manual") || r.recommendedAction.toLowerCase().includes("conflict"), "manual verification recommended");
}

// ---------------------------------------------------------------------------
// CASE 5: Missing / corrupt evidence
// Input: single low report, no evidence (insufficient data)
// System behavior: MISSING_EVIDENCE, INSUFFICIENT_DATA states
// State: MISSING_EVIDENCE
// Dashboard: MISSING_EVIDENCE badge, low confidence
// Expected action: request evidence
// ---------------------------------------------------------------------------
console.log("\nCase 5: Missing / corrupt evidence");
{
  const reports: Report[] = [
    mkReport({
      latitude: 28.602,
      longitude: 77.272,
      reportedTime: mins(-70),
      citizenSeverity: "Medium",
      description: "Bin maybe overflowing, not sure",
    }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  check(r.operationalStates.includes("MISSING_EVIDENCE"), "MISSING_EVIDENCE surfaced");
  check(r.confidenceScore <= 10, `low confidence (got ${r.confidenceScore})`);
  check(
    r.recommendedAction.toLowerCase().includes("evidence") || r.recommendedAction.toLowerCase().includes("data"),
    "action requests evidence"
  );

  // Sub-case: corrupt evidence (sourceStatus=Corrupted)
  const corruptEvidence = [mkEvidence({ sourceStatus: "Corrupted" })];
  const r2 = evaluateIncident(reports, corruptEvidence, [], now);
  check(r2.operationalStates.includes("MISSING_EVIDENCE"), "corrupt evidence → MISSING_EVIDENCE");
}

// ---------------------------------------------------------------------------
// CASE 6: Corroboration unavailable
// Input: single isolated report, no nearby reports, no evidence
// System behavior: no corroboration bonus, single-report confidence
// State: PENDING_VERIFICATION
// Dashboard: PENDING, low confidence, recommend monitor/verify
// Expected action: monitor or verify
// ---------------------------------------------------------------------------
console.log("\nCase 6: Corroboration unavailable");
{
  const reports: Report[] = [
    mkReport({
      latitude: 28.57,
      longitude: 77.20,
      reportedTime: mins(-200),
      citizenSeverity: "Low",
      description: "Small pothole, minor",
    }),
  ];
  const r = evaluateIncident(reports, [], [], now);
  check(r.confidenceScore <= 10, `uncorroborated confidence low (got ${r.confidenceScore})`);
  check(r.status === "Pending" || r.status === "Unknown", `status Pending/Unknown (got ${r.status})`);
  check(r.operationalStates.includes("PENDING_VERIFICATION") || r.operationalStates.includes("INSUFFICIENT_DATA"), "PENDING or INSUFFICIENT_DATA surfaced");
}

// ---------------------------------------------------------------------------
// CASE 7: Responder verification — rejected (false alarm)
// Input: Critical report but responder marks Rejected
// System behavior: confidence = 0, status Rejected
// State: REJECTED
// Dashboard: REJECTED badge, confidence 0
// Expected action: no action required
// ---------------------------------------------------------------------------
console.log("\nCase 7: Responder verification rejected");
{
  const reports: Report[] = [
    mkReport({
      latitude: 28.595,
      longitude: 77.265,
      reportedTime: mins(-40),
      citizenSeverity: "Critical",
      description: "Hazardous waste dumped!",
    }),
  ];
  const verifications: ResponderVerification[] = [
    mkVerification({ verificationStatus: "Rejected", notes: "Inspected, false alarm" }),
  ];
  const r = evaluateIncident(reports, [], verifications, now);
  check(r.confidenceScore === 0, `rejected confidence = 0 (got ${r.confidenceScore})`);
  check(r.status === "Rejected", `status Rejected (got ${r.status})`);
  check(r.operationalStates.includes("REJECTED"), "REJECTED surfaced");
  check(r.recommendedAction.toLowerCase().includes("no action"), "no action required");
}

// ---------------------------------------------------------------------------
// CASE 7b: Responder verification — verified (overrides everything)
// Input: even a single conflicting report, but responder verifies
// System behavior: confidence = 100, status Verified
// State: VERIFIED
// Dashboard: VERIFIED badge, confidence 100
// Expected action: immediate response/dispatch
// ---------------------------------------------------------------------------
console.log("\nCase 7b: Responder verification verified (override)");
{
  const reports: Report[] = [
    mkReport({
      latitude: 28.62,
      longitude: 77.21,
      reportedTime: mins(-60),
      citizenSeverity: "High",
      conflictingEvidence: "yes",
    }),
  ];
  const verifications: ResponderVerification[] = [
    mkVerification({ verificationStatus: "Verified" }),
  ];
  const r = evaluateIncident(reports, [], verifications, now);
  check(r.confidenceScore === 100, `verified confidence = 100 (got ${r.confidenceScore})`);
  check(r.status === "Verified", `status Verified (got ${r.status})`);
  check(r.operationalStates.includes("VERIFIED"), "VERIFIED surfaced");
}

// ---------------------------------------------------------------------------
// CASE 8: API / data failure (empty input)
// Input: no reports, no evidence, no verifications
// System behavior: returns Unknown status gracefully
// State: Unknown
// Dashboard: handles empty gracefully
// Expected action: request additional details
// ---------------------------------------------------------------------------
console.log("\nCase 8: Empty / API failure input");
{
  const r = evaluateIncident([], [], [], now);
  check(r.status === "Unknown", `empty → Unknown status (got ${r.status})`);
  check(r.freshness === "Unknown", `empty → Unknown freshness (got ${r.freshness})`);
  check(r.confidenceScore === 10, `empty → base confidence 10 (got ${r.confidenceScore})`);
  // Empty input has no evidence, so MISSING_EVIDENCE is legitimately surfaced
  check(
    r.operationalStates.includes("MISSING_EVIDENCE"),
    "empty input → MISSING_EVIDENCE surfaced (no evidence available)"
  );
  check(r.priorityScore < 30, `empty → low priority (got ${r.priorityScore})`);
}

// ---------------------------------------------------------------------------
// CASE 9: Spatial correlation correctness (haversine)
// ---------------------------------------------------------------------------
console.log("\nCase 9: Spatial correlation correctness");
{
  // Same point
  check(haversineDistanceMeters(28.61, 77.21, 28.61, 77.21) === 0, "identical point = 0m");
  // ~11m apart (should be within 25m duplicate threshold)
  const d1 = haversineDistanceMeters(28.6139, 77.209, 28.6139, 77.2091);
  check(d1 < 25, `nearby point < 25m (got ${d1.toFixed(1)}m)`);
  // ~1km apart (should NOT be duplicate)
  const d2 = haversineDistanceMeters(28.6139, 77.209, 28.6239, 77.219);
  check(d2 > 200, `distant point > 200m (got ${d2.toFixed(0)}m)`);
}

// ---------------------------------------------------------------------------
// CASE 10: Fresh vs Aging boundary
// ---------------------------------------------------------------------------
console.log("\nCase 10: Freshness boundaries");
{
  // 23h old → Fresh
  const r1 = evaluateIncident(
    [mkReport({ reportedTime: mins(-23 * 60), latitude: 28.6, longitude: 77.2 })],
    [], [], now
  );
  check(r1.freshness === "Fresh", `23h old = Fresh (got ${r1.freshness})`);

  // 25h old → Aging
  const r2 = evaluateIncident(
    [mkReport({ reportedTime: mins(-25 * 60), latitude: 28.6, longitude: 77.2 })],
    [], [], now
  );
  check(r2.freshness === "Aging", `25h old = Aging (got ${r2.freshness})`);

  // 73h old → Stale
  const r3 = evaluateIncident(
    [mkReport({ reportedTime: mins(-73 * 60), latitude: 28.6, longitude: 77.2 })],
    [], [], now
  );
  check(r3.freshness === "Stale", `73h old = Stale (got ${r3.freshness})`);
}

// ---------------------------------------------------------------------------
// CASE 11: All three municipal categories work
// ---------------------------------------------------------------------------
console.log("\nCase 11: Municipal categories (Roads / Street Lighting / Waste)");
{
  for (const [cat, issue] of [
    ["Roads", "pothole"],
    ["Street Lighting", "streetlight_not_working"],
    ["Waste", "garbage_accumulation"],
  ] as const) {
    const r = evaluateIncident(
      [mkReport({ category: cat, issueType: issue, latitude: 28.6, longitude: 77.2, reportedTime: mins(-30) })],
      [], [], now
    );
    check(r.status !== "Unknown", `${cat}/${issue} evaluates without error`);
  }
}

// ---------------------------------------------------------------------------
// CASE 12: High-priority corroboration surfaces correctly
// ---------------------------------------------------------------------------
console.log("\nCase 12: High-priority corroboration");
{
  const reports: Report[] = [
    mkReport({ id: "r1", latitude: 28.65, longitude: 77.22, reportedTime: mins(-15), citizenSeverity: "Critical" }),
    mkReport({ id: "r2", latitude: 28.6505, longitude: 77.2205, reportedTime: mins(-12), citizenSeverity: "Critical" }),
    mkReport({ id: "r3", latitude: 28.651, longitude: 77.221, reportedTime: mins(-10), citizenSeverity: "High" }),
  ];
  const ev = [mkEvidence({ sourceStatus: "High Quality" })];
  const r = evaluateIncident(reports, ev, [], now);
  check(r.priorityLevel === "Critical", `priority Critical (got ${r.priorityLevel})`);
  check(r.priorityScore >= 80, `priority score >= 80 (got ${r.priorityScore})`);
  check(r.operationalStates.includes("HIGH_PRIORITY"), "HIGH_PRIORITY surfaced");
  check(r.confidenceScore >= 70, `confidence >= 70 Corroborated (got ${r.confidenceScore})`);
  check(r.status === "Corroborated", `status Corroborated (got ${r.status})`);
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
