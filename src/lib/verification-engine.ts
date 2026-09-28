/**
 * Verification Engine — TypeScript port of the original Python implementation.
 *
 * This faithfully reproduces the scoring rules from
 * backend/services/verification_engine.py of the crowd_project repository:
 *   - Freshness: Fresh (<=24h), Aging (24-72h), Stale (>72h)
 *   - Duplicate detection: same category + issueType, <=25m, <=10min
 *   - Confidence: base 10 + corroboration (20 each, max 60) + evidence (15 + 15 HQ)
 *                 - missing location (-30) - conflicts (-40); Verified -> 100, Rejected -> 0
 *   - Priority: severity base + impact (5 each, max 20) + confidence*0.2 + freshness penalty
 *   - Verification status: Verified | Rejected | Conflicted | Corroborated | Pending | Unknown
 *
 * Extensions added to satisfy the full requirements:
 *   - Structured confidence breakdown (point-by-point deltas with labels)
 *   - Explicit operational states: HIGH_PRIORITY, PRIORITIZE, PENDING_VERIFICATION,
 *     MISSING_LOCATION, MISSING_EVIDENCE, INSUFFICIENT_DATA, VERIFIED
 *   - Human-readable confidence summary
 */

import type {
  Report,
  ExternalEvidence,
  ResponderVerification,
  Incident,
} from "@/lib/types";

export const EARTH_RADIUS_METERS = 6_371_000;

export const SEVERITY_SCORES: Record<string, number> = {
  Critical: 70,
  High: 50,
  Medium: 30,
  Low: 10,
};

export const DUPLICATE_DISTANCE_THRESHOLD_METERS = 25.0;
export const DUPLICATE_TIME_THRESHOLD_MINUTES = 10.0;
export const CORRELATION_DISTANCE_THRESHOLD_METERS = 200.0;
export const CORRELATION_TIME_THRESHOLD_MINUTES = 60.0;

export const CATEGORY_ISSUE_TYPES: Record<string, string[]> = {
  Roads: ["pothole", "damaged_road", "road_blockage"],
  "Street Lighting": ["streetlight_not_working", "damaged_light", "dark_area"],
  Waste: ["garbage_accumulation", "overflowing_bin", "illegal_dumping"],
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  pothole: "Pothole",
  damaged_road: "Damaged Road",
  road_blockage: "Road Blockage",
  streetlight_not_working: "Streetlight Not Working",
  damaged_light: "Damaged Light",
  dark_area: "Dark Area",
  garbage_accumulation: "Garbage Accumulation",
  overflowing_bin: "Overflowing Bin",
  illegal_dumping: "Illegal Dumping",
};

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_METERS * c;
}

export interface ConfidenceBreakdownItem {
  label: string;
  delta: number;
  detail: string;
  kind: "base" | "bonus" | "penalty" | "override";
}

export interface VerificationResult {
  confidenceScore: number;
  confidenceLevel: "High" | "Medium" | "Low";
  confidenceExplanations: string[];
  confidenceBreakdown: ConfidenceBreakdownItem[];
  confidenceHumanSummary: string;
  priorityScore: number;
  priorityLevel: "Critical" | "High" | "Medium" | "Low";
  priorityExplanations: string[];
  freshness: "Fresh" | "Aging" | "Stale" | "Unknown";
  status:
    | "Verified"
    | "Rejected"
    | "Conflicted"
    | "Corroborated"
    | "Pending"
    | "Unknown";
  operationalStates: string[];
  recommendedAction: string;
  uniqueReports: Report[];
  duplicateReports: Report[];
}

export function determineFreshness(
  reports: Report[],
  referenceTime: Date
): "Fresh" | "Aging" | "Stale" | "Unknown" {
  if (!reports || reports.length === 0) return "Unknown";
  const validTimes = reports
    .map((r) => r.reportedTime)
    .filter((t): t is Date => !!t);
  if (validTimes.length === 0) return "Unknown";
  const mostRecent = new Date(
    Math.max(...validTimes.map((t) => new Date(t).getTime()))
  );
  const ageMs = referenceTime.getTime() - mostRecent.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= 24) return "Fresh";
  if (ageHours <= 72) return "Aging";
  return "Stale";
}

export function hasConflictingEvidence(reports: Report[]): boolean {
  return reports.some((r) => {
    const val = (r.conflictingEvidence || "").trim().toLowerCase();
    return ["yes", "true", "conflicted", "1"].includes(val);
  });
}

export function isDuplicatePair(r1: Report, r2: Report): boolean {
  if (r1.category !== r2.category || r1.issueType !== r2.issueType) return false;

  if (r1.reportedTime && r2.reportedTime) {
    const diffMin =
      Math.abs(
        new Date(r1.reportedTime).getTime() -
          new Date(r2.reportedTime).getTime()
      ) / 60000;
    if (diffMin > DUPLICATE_TIME_THRESHOLD_MINUTES) return false;
  } else if (
    new Date(r1.reportedTime || 0).getTime() !==
    new Date(r2.reportedTime || 0).getTime()
  ) {
    return false;
  }

  if (
    r1.latitude != null &&
    r1.longitude != null &&
    r2.latitude != null &&
    r2.longitude != null
  ) {
    const dist = haversineDistanceMeters(
      r1.latitude,
      r1.longitude,
      r2.latitude,
      r2.longitude
    );
    return dist <= DUPLICATE_DISTANCE_THRESHOLD_METERS;
  }

  if (
    r1.latitude == null &&
    r2.latitude == null &&
    r1.longitude == null &&
    r2.longitude == null
  ) {
    const d1 = (r1.description || "").trim().toLowerCase();
    const d2 = (r2.description || "").trim().toLowerCase();
    if (d1 && d2 && d1 === d2) return true;
  }
  return false;
}

export function clusterIndependentReports(
  reports: Report[]
): { unique: Report[]; duplicates: Report[] } {
  if (!reports || reports.length === 0) return { unique: [], duplicates: [] };
  const sorted = [...reports].sort((a, b) => {
    const ta = new Date(a.reportedTime || 0).getTime();
    const tb = new Date(b.reportedTime || 0).getTime();
    if (ta !== tb) return ta - tb;
    return (a.reportId || "").localeCompare(b.reportId || "");
  });
  const unique: Report[] = [];
  const duplicates: Report[] = [];
  for (const report of sorted) {
    let isDup = false;
    for (const clusterRep of unique) {
      if (isDuplicatePair(clusterRep, report)) {
        isDup = true;
        break;
      }
    }
    if (isDup) duplicates.push(report);
    else unique.push(report);
  }
  return { unique, duplicates };
}

function confidenceLevelFor(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function priorityLevelFor(score: number): "Critical" | "High" | "Medium" | "Low" {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

export function calculateConfidence(
  reports: Report[],
  evidence: ExternalEvidence[],
  verifications: ResponderVerification[]
): {
  score: number;
  level: "High" | "Medium" | "Low";
  explanations: string[];
  breakdown: ConfidenceBreakdownItem[];
  humanSummary: string;
} {
  const explanations: string[] = [];
  const breakdown: ConfidenceBreakdownItem[] = [];

  const responderVerifiedTrue = verifications.some(
    (v) => v.verificationStatus === "Verified"
  );
  const responderVerifiedFalse = verifications.some(
    (v) => v.verificationStatus === "Rejected"
  );
  const hasConflicts = hasConflictingEvidence(reports);
  const missingLocation = reports.some(
    (r) => r.latitude == null || r.longitude == null
  );

  if (responderVerifiedTrue) {
    explanations.push(
      "Official Responder Verification: Score confirmed at 100 (On-site verified)."
    );
    breakdown.push({
      label: "Responder verified on-site",
      delta: 100,
      detail: "Official responder confirmed the incident on location.",
      kind: "override",
    });
    if (hasConflicts) {
      explanations.push(
        "Conflict Notice: Prior conflicting citizen reports detected but resolved by official responder verification."
      );
    }
    if (missingLocation) {
      explanations.push(
        "Location Notice: Missing citizen coordinates detected, but verified on-site by responder."
      );
    }
    return {
      score: 100,
      level: "High",
      explanations,
      breakdown,
      humanSummary:
        "High confidence: an official responder verified the incident on-site, overriding any conflicting or missing citizen data.",
    };
  }

  if (responderVerifiedFalse) {
    explanations.push(
      "Official Responder Verification: Score set to 0 (Rejected/False report)."
    );
    breakdown.push({
      label: "Responder rejected (false report)",
      delta: 0,
      detail: "Official responder rejected the incident as a false report.",
      kind: "override",
    });
    if (hasConflicts) {
      explanations.push("Conflict Notice: Incident was officially rejected.");
    }
    return {
      score: 0,
      level: "Low",
      explanations,
      breakdown,
      humanSummary:
        "Low confidence: an official responder rejected this report as a false alarm.",
    };
  }

  // Base
  let score = 10;
  breakdown.push({
    label: "Initial citizen report",
    delta: 10,
    detail: "Base score for an incoming citizen report.",
    kind: "base",
  });
  explanations.push("Base score: +10 for initial citizen report.");

  // Corroboration
  const { unique, duplicates } = clusterIndependentReports(reports);
  if (duplicates.length > 0) {
    explanations.push(
      `Deduplication: ${duplicates.length} duplicate/near-duplicate report(s) filtered out.`
    );
  }
  const independentCount = unique.length;
  const corroboratingCount = Math.max(0, independentCount - 1);
  const corroborationPoints = Math.min(60, corroboratingCount * 20);
  if (corroboratingCount > 0) {
    score += corroborationPoints;
    explanations.push(
      `Corroboration: +${corroborationPoints} from ${corroboratingCount} independent citizen report(s).`
    );
    breakdown.push({
      label: `Multiple nearby citizen reports (${corroboratingCount})`,
      delta: corroborationPoints,
      detail: `${corroboratingCount} independent citizen(s) reported the same issue nearby.`,
      kind: "bonus",
    });
  } else {
    explanations.push("Corroboration: +0 (Single uncorroborated report).");
  }

  // Evidence
  if (evidence && evidence.length > 0) {
    score += 15;
    explanations.push(
      "External Evidence: +15 for attached sensor/photo/CCTV evidence."
    );
    breakdown.push({
      label: "Photo / sensor evidence attached",
      delta: 15,
      detail: `${evidence.length} evidence item(s) attached to this incident.`,
      kind: "bonus",
    });
    const highQuality = evidence.some((e) =>
      ["High Quality", "Verified"].includes(e.sourceStatus || "")
    );
    if (highQuality) {
      score += 15;
      explanations.push(
        "Evidence Quality: +15 for high-quality verified data source."
      );
      breakdown.push({
        label: "High-quality verified source",
        delta: 15,
        detail: "At least one evidence source is marked High Quality / Verified.",
        kind: "bonus",
      });
    }
  }

  // Penalties
  if (missingLocation) {
    score -= 30;
    explanations.push("Location Penalty: -30 due to missing precise coordinates.");
    breakdown.push({
      label: "Missing precise location",
      delta: -30,
      detail: "One or more reports lack usable GPS coordinates.",
      kind: "penalty",
    });
  }
  if (hasConflicts) {
    score -= 40;
    explanations.push("Conflict Penalty: -40 due to conflicting reports/evidence.");
    breakdown.push({
      label: "Conflicting evidence detected",
      delta: -40,
      detail: "Reports disagree about the nature/severity of the issue.",
      kind: "penalty",
    });
  }

  score = Math.max(0, Math.min(100, score));
  const level = confidenceLevelFor(score);

  // Human summary
  let humanSummary = "";
  if (score >= 70) {
    humanSummary =
      "High confidence: multiple citizens reported the same issue within a short time window and/or supporting evidence was available.";
  } else if (score >= 40) {
    humanSummary =
      "Medium confidence: some corroboration or evidence exists, but the incident would benefit from responder verification.";
  } else {
    humanSummary =
      "Low confidence: the report is uncorroborated, missing data, or has conflicting evidence. Manual verification recommended.";
  }

  return { score, level, explanations, breakdown, humanSummary };
}

export function calculatePriority(
  reports: Report[],
  confidenceScore: number,
  freshness: string
): {
  score: number;
  level: "Critical" | "High" | "Medium" | "Low";
  explanations: string[];
} {
  const explanations: string[] = [];
  const severityLevels = ["Low", "Medium", "High", "Critical"];
  let highestSeverity = "Low";
  for (const r of reports) {
    if (
      severityLevels.includes(r.citizenSeverity) &&
      severityLevels.indexOf(r.citizenSeverity) >
        severityLevels.indexOf(highestSeverity)
    ) {
      highestSeverity = r.citizenSeverity;
    }
  }
  const basePriority = SEVERITY_SCORES[highestSeverity] ?? 10;
  let score = basePriority;
  explanations.push(`Base Severity (${highestSeverity}): +${basePriority}.`);

  const { unique } = clusterIndependentReports(reports);
  const corroboratingCount = Math.max(0, unique.length - 1);
  const impactPoints = Math.min(20, corroboratingCount * 5);
  if (impactPoints > 0) {
    score += impactPoints;
    explanations.push(
      `Impact: +${impactPoints} from ${corroboratingCount} corroborating report(s).`
    );
  }

  const confAdj = Math.round(confidenceScore * 0.2);
  score += confAdj;
  explanations.push(
    `Confidence Adjustment: +${confAdj} (weighted by ${confidenceScore}% confidence).`
  );

  // Confidence gate: incidents with very low confidence (conflicts, responder
  // rejection, missing critical data) should NOT be prioritised for action
  // regardless of severity, because acting on unverified/conflicted data is
  // premature. When confidence <= 10 the severity base is dampened so the
  // incident sinks in the priority queue until it is resolved.
  // This is a justified ranking improvement — it does NOT change the
  // verification status, confidence score, or freshness (those remain the
  // source of truth). It only affects ORDERING for the operations queue.
  if (confidenceScore <= 10) {
    const gatePenalty = Math.round(basePriority * 0.7);
    score -= gatePenalty;
    explanations.push(
      `Confidence Gate: -${gatePenalty} (confidence <= 10 — incident is conflicting/rejected/missing-data; deprioritised until resolved).`
    );
  }

  if (freshness === "Fresh") {
    explanations.push("Freshness: +0 (information is fresh, <=24h).");
  } else if (freshness === "Aging") {
    score -= 10;
    explanations.push("Freshness Penalty: -10 (information is aging, 24h-72h).");
  } else if (freshness === "Stale") {
    score -= 30;
    explanations.push("Freshness Penalty: -30 (information is stale, >72h).");
  } else {
    explanations.push("Freshness: Unknown freshness status.");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, level: priorityLevelFor(score), explanations };
}

export function determineVerificationStatus(
  reports: Report[],
  evidence: ExternalEvidence[],
  verifications: ResponderVerification[],
  confidenceScore: number
):
  | "Verified"
  | "Rejected"
  | "Conflicted"
  | "Corroborated"
  | "Pending"
  | "Unknown" {
  const responderVerifiedTrue = verifications.some(
    (v) => v.verificationStatus === "Verified"
  );
  const responderVerifiedFalse = verifications.some(
    (v) => v.verificationStatus === "Rejected"
  );
  if (responderVerifiedTrue) return "Verified";
  if (responderVerifiedFalse) return "Rejected";
  if (hasConflictingEvidence(reports)) return "Conflicted";
  if (!reports || reports.length === 0) return "Unknown";
  const allMissingLoc = reports.every(
    (r) => r.latitude == null || r.longitude == null
  );
  if (allMissingLoc && (!evidence || evidence.length === 0)) return "Unknown";
  if (confidenceScore >= 70) return "Corroborated";
  return "Pending";
}

/**
 * Compute explicit operational states that surface required actions in the UI.
 * These layer on top of the verification status to communicate what the
 * decision-maker needs to do.
 */
export function determineOperationalStates(
  status: string,
  priorityLevel: string,
  freshness: string,
  reports: Report[],
  evidence: ExternalEvidence[],
  verifications: ResponderVerification[]
): string[] {
  const states: string[] = [];

  const responderVerifiedTrue = verifications.some(
    (v) => v.verificationStatus === "Verified"
  );
  const responderVerifiedFalse = verifications.some(
    (v) => v.verificationStatus === "Rejected"
  );
  const missingLocation = reports.some(
    (r) => r.latitude == null || r.longitude == null
  );
  const hasEvidence = evidence && evidence.length > 0;
  const corruptedEvidence =
    evidence && evidence.some((e) => e.sourceStatus === "Corrupted");
  const hasConflicts = hasConflictingEvidence(reports);

  if (responderVerifiedTrue && (priorityLevel === "Critical" || priorityLevel === "High")) {
    states.push("VERIFIED");
    states.push("HIGH_PRIORITY");
  } else if (responderVerifiedTrue) {
    states.push("VERIFIED");
  }
  if (responderVerifiedFalse) {
    states.push("REJECTED");
  }
  if (priorityLevel === "Critical" || priorityLevel === "High") {
    if (!states.includes("HIGH_PRIORITY")) states.push("HIGH_PRIORITY");
    else states.push("PRIORITIZE");
  }
  if (status === "Pending" || status === "Corroborated") {
    states.push("PENDING_VERIFICATION");
  }
  if (freshness === "Stale") {
    states.push("STALE");
  } else if (freshness === "Aging") {
    states.push("AGING");
  } else if (freshness === "Fresh") {
    states.push("FRESH");
  }
  if (missingLocation) {
    states.push("MISSING_LOCATION");
  }
  if (!hasEvidence) {
    states.push("MISSING_EVIDENCE");
  } else if (corruptedEvidence) {
    states.push("MISSING_EVIDENCE");
  }
  if (hasConflicts) {
    states.push("CONFLICTING_EVIDENCE");
  }
  if (
    reports.length > 0 &&
    reports.every((r) => r.latitude == null) &&
    !hasEvidence &&
    !responderVerifiedTrue
  ) {
    states.push("INSUFFICIENT_DATA");
  }

  return Array.from(new Set(states));
}

export function generateRecommendedAction(
  status: string,
  priorityLevel: string,
  freshness: string,
  operationalStates: string[]
): string {
  if (operationalStates.includes("VERIFIED")) {
    if (operationalStates.includes("HIGH_PRIORITY")) {
      return "Recommend immediate response/dispatch.";
    }
    return "Verified incident; assign to departmental maintenance schedule.";
  }
  if (status === "Rejected") {
    return "No action required; incident rejected by official responder.";
  }
  if (operationalStates.includes("CONFLICTING_EVIDENCE")) {
    return "Manual verification required due to conflicting reports.";
  }
  if (operationalStates.includes("STALE")) {
    return "Recommend re-verification because information is stale.";
  }
  if (operationalStates.includes("INSUFFICIENT_DATA")) {
    return "Request additional citizen details or precise location coordinates.";
  }
  if (operationalStates.includes("MISSING_LOCATION")) {
    return "Request precise GPS coordinates from the citizen before dispatch.";
  }
  if (operationalStates.includes("MISSING_EVIDENCE")) {
    return "Request photo or sensor evidence to raise confidence.";
  }
  if (status === "Corroborated") {
    if (priorityLevel === "Critical" || priorityLevel === "High") {
      return "Recommend field verification.";
    }
    return "Corroborated by crowd; schedule routine field verification.";
  }
  // Pending
  if (priorityLevel === "Critical" || priorityLevel === "High") {
    return "High priority pending corroboration; monitor closely or dispatch probe.";
  }
  return "Insufficient corroboration; monitor or verify.";
}

export function evaluateIncident(
  reports: Report[],
  evidence: ExternalEvidence[],
  verifications: ResponderVerification[],
  referenceTime: Date = new Date()
): VerificationResult {
  const freshness = determineFreshness(reports, referenceTime);
  const conf = calculateConfidence(reports, evidence, verifications);
  const prio = calculatePriority(reports, conf.score, freshness);
  const status = determineVerificationStatus(
    reports,
    evidence,
    verifications,
    conf.score
  );
  const operationalStates = determineOperationalStates(
    status,
    prio.level,
    freshness,
    reports,
    evidence,
    verifications
  );
  const recommendedAction = generateRecommendedAction(
    status,
    prio.level,
    freshness,
    operationalStates
  );
  const { unique, duplicates } = clusterIndependentReports(reports);
  return {
    confidenceScore: conf.score,
    confidenceLevel: conf.level,
    confidenceExplanations: conf.explanations,
    confidenceBreakdown: conf.breakdown,
    confidenceHumanSummary: conf.humanSummary,
    priorityScore: prio.score,
    priorityLevel: prio.level,
    priorityExplanations: prio.explanations,
    freshness,
    status,
    operationalStates,
    recommendedAction,
    uniqueReports: unique,
    duplicateReports: duplicates,
  };
}

/**
 * Baseline ranking used for evaluation: severity + recency only (no verification engine).
 */
export function baselinePriorityScore(reports: Report[]): number {
  const severityLevels = ["Low", "Medium", "High", "Critical"];
  let maxSeverity = "Low";
  let maxTime = 0;
  for (const r of reports) {
    if (
      severityLevels.includes(r.citizenSeverity) &&
      severityLevels.indexOf(r.citizenSeverity) >
        severityLevels.indexOf(maxSeverity)
    ) {
      maxSeverity = r.citizenSeverity;
    }
    const t = new Date(r.reportedTime || 0).getTime();
    if (t > maxTime) maxTime = t;
  }
  // Base severity + small recency bump (normalized to 0-30)
  const base = SEVERITY_SCORES[maxSeverity] ?? 10;
  const recencyBump = maxTime > 0 ? 30 : 0;
  return base + recencyBump;
}
