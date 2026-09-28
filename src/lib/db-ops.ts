/**
 * Database operations for the Crowd-Report Verification Dashboard.
 * Wraps Prisma calls and recomputes verification-engine evaluations
 * whenever reports / evidence / verifications change.
 */

import { db } from "@/lib/db";
import { evaluateIncident } from "@/lib/verification-engine";
import { findMatchingIncident } from "@/lib/correlation";
import type {
  Report,
  Incident,
  ExternalEvidence,
  ResponderVerification,
  IncidentDetail,
} from "@/lib/types";
import { randomUUID } from "crypto";

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function newReportId(): string {
  return makeId("RPT");
}
export function newIncidentId(): string {
  return makeId("INC");
}
export function newEvidenceId(): string {
  return makeId("EVD");
}

export function toReportType(r: any): Report {
  return {
    id: r.id,
    reportId: r.reportId,
    category: r.category,
    issueType: r.issueType,
    description: r.description,
    zone: r.zone,
    latitude: r.latitude,
    longitude: r.longitude,
    reportedTime: r.reportedTime,
    citizenSeverity: r.citizenSeverity,
    citizenName: r.citizenName,
    corroboratingReports: r.corroboratingReports,
    locationStatus: r.locationStatus,
    freshnessStatus: r.freshnessStatus,
    conflictingEvidence: r.conflictingEvidence,
    createdAt: r.createdAt,
  };
}

export function toEvidenceType(e: any): ExternalEvidence {
  return {
    id: e.id,
    evidenceId: e.evidenceId,
    incidentId: e.incidentId,
    reportId: e.reportId,
    sourceType: e.sourceType,
    sourceStatus: e.sourceStatus,
    observedAt: e.observedAt,
    freshnessStatus: e.freshnessStatus,
    details: e.details,
    fileName: e.fileName,
    fileUrl: e.fileUrl,
    fileSize: e.fileSize,
    mimeType: e.mimeType,
    latitude: e.latitude,
    longitude: e.longitude,
    createdAt: e.createdAt,
  };
}

export function toVerificationType(v: any): ResponderVerification {
  return {
    id: v.id,
    incidentId: v.incidentId,
    responderId: v.responderId,
    responderName: v.responderName,
    verificationStatus: v.verificationStatus,
    notes: v.notes,
    verifiedAt: v.verifiedAt,
    createdAt: v.createdAt,
  };
}

export function toIncidentType(i: any): Incident {
  return {
    id: i.id,
    incidentId: i.incidentId,
    category: i.category,
    issueType: i.issueType,
    zone: i.zone,
    status: i.status,
    humanStatus: i.humanStatus,
    priorityScore: i.priorityScore,
    priorityLevel: i.priorityLevel,
    confidenceScore: i.confidenceScore,
    confidenceLevel: i.confidenceLevel,
    freshnessStatus: i.freshnessStatus,
    totalReportsCount: i.totalReportsCount,
    independentReportsCount: i.independentReportsCount,
    duplicateReportsCount: i.duplicateReportsCount,
    latitude: i.latitude,
    longitude: i.longitude,
    lastReportedTime: i.lastReportedTime,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

/**
 * Recompute and persist the full verification evaluation for an incident.
 * Returns the computed result + the persisted incident.
 */
export async function recomputeIncident(incidentDbId: string) {
  const incident = await db.incident.findUnique({
    where: { id: incidentDbId },
    include: {
      incidentLinks: { include: { report: true } },
      evidence: true,
      responderVerifications: true,
    },
  });
  if (!incident) return null;

  const reports = incident.incidentLinks.map((l) => toReportType(l.report));
  const evidence = incident.evidence.map(toEvidenceType);
  const verifications = incident.responderVerifications.map(toVerificationType);

  const evaluation = evaluateIncident(reports, evidence, verifications);

  const { uniqueReports: unique, duplicateReports: duplicates } = evaluation;

  const validCoords = reports.filter(
    (r) => r.latitude != null && r.longitude != null
  );
  const lat = validCoords[0]?.latitude ?? null;
  const lon = validCoords[0]?.longitude ?? null;
  const validTimes = reports.map((r) => new Date(r.reportedTime));
  const lastReportedTime =
    validTimes.length > 0
      ? new Date(Math.max(...validTimes.map((t) => t.getTime())))
      : null;

  const updated = await db.incident.update({
    where: { id: incidentDbId },
    data: {
      status: evaluation.status,
      priorityScore: evaluation.priorityScore,
      priorityLevel: evaluation.priorityLevel,
      confidenceScore: evaluation.confidenceScore,
      confidenceLevel: evaluation.confidenceLevel,
      freshnessStatus: evaluation.freshness,
      totalReportsCount: reports.length,
      independentReportsCount: unique.length,
      duplicateReportsCount: duplicates.length,
      latitude: lat,
      longitude: lon,
      lastReportedTime,
    },
  });

  // Update per-report freshness / location status
  for (const report of reports) {
    await db.report.update({
      where: { id: report.id },
      data: {
        freshnessStatus: evaluation.freshness,
        locationStatus:
          report.latitude != null && report.longitude != null
            ? "Available"
            : "Missing",
      },
    });
  }

  return { incident: updated, evaluation, reports, evidence, verifications };
}

/**
 * Submit a citizen report: create report + incident (or attach to existing),
 * then recompute.
 */
export async function submitReport(input: {
  category: string;
  issueType: string;
  description?: string;
  zone?: string;
  latitude?: number | null;
  longitude?: number | null;
  citizenSeverity: string;
  citizenName?: string;
  conflictingEvidence?: string;
}) {
  const reportId = newReportId();
  const now = new Date();

  // Find candidate incidents to correlate with
  const candidateIncidents = await db.incident.findMany({
    where: {
      category: input.category,
      issueType: input.issueType,
      incidentLinks: {
        some: {
          report: {
            reportedTime: {
              gte: new Date(now.getTime() - 60 * 60 * 1000),
              lte: new Date(now.getTime() + 60 * 60 * 1000),
            },
          },
        },
      },
    },
    include: {
      incidentLinks: { include: { report: true } },
    },
  });

  const incomingReport: Report = {
    id: "pending",
    reportId,
    category: input.category,
    issueType: input.issueType,
    description: input.description ?? null,
    zone: input.zone ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    reportedTime: now,
    citizenSeverity: input.citizenSeverity,
    citizenName: input.citizenName ?? null,
    corroboratingReports: 0,
    locationStatus:
      input.latitude != null && input.longitude != null
        ? "Available"
        : "Missing",
    freshnessStatus: "Pending",
    conflictingEvidence: input.conflictingEvidence ?? "no",
    createdAt: now,
  };

  const candidates = candidateIncidents.map((i) => ({
    incident: toIncidentType(i),
    reports: i.incidentLinks.map((l) => toReportType(l.report)),
  }));
  const matchingId = findMatchingIncident(incomingReport, candidates);

  const report = await db.report.create({
    data: {
      reportId,
      category: input.category,
      issueType: input.issueType,
      description: input.description ?? null,
      zone: input.zone ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      reportedTime: now,
      citizenSeverity: input.citizenSeverity,
      citizenName: input.citizenName ?? null,
      locationStatus: incomingReport.locationStatus,
      freshnessStatus: "Pending",
      conflictingEvidence: input.conflictingEvidence ?? "no",
    },
  });

  let incidentDbId: string;
  if (matchingId) {
    incidentDbId = matchingId;
    await db.incidentReport.create({
      data: { incidentId: matchingId, reportId: report.id },
    });
  } else {
    const incident = await db.incident.create({
      data: {
        incidentId: newIncidentId(),
        category: input.category,
        issueType: input.issueType,
        zone: input.zone ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        status: "Pending",
      },
    });
    incidentDbId = incident.id;
    await db.incidentReport.create({
      data: { incidentId: incident.id, reportId: report.id },
    });
  }

  const result = await recomputeIncident(incidentDbId);
  return { report, result };
}

/**
 * Attach evidence to an incident and recompute.
 */
export async function attachEvidence(input: {
  incidentId: string; // INC- id
  sourceType: string;
  sourceStatus: string;
  observedAt?: Date;
  details?: string;
  fileName?: string;
  filePath?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  latitude?: number | null;
  longitude?: number | null;
  reportId?: string;
}) {
  const incident = await db.incident.findFirst({
    where: { incidentId: input.incidentId },
  });
  if (!incident) return null;

  const observedAt = input.observedAt ?? new Date();
  const evidence = await db.externalEvidence.create({
    data: {
      evidenceId: newEvidenceId(),
      incidentId: incident.id,
      reportId: input.reportId ?? null,
      sourceType: input.sourceType,
      sourceStatus: input.sourceStatus,
      observedAt,
      freshnessStatus:
        (Date.now() - observedAt.getTime()) / 3600000 <= 24
          ? "Fresh"
          : (Date.now() - observedAt.getTime()) / 3600000 <= 72
          ? "Aging"
          : "Stale",
      details: input.details ?? null,
      fileName: input.fileName ?? null,
      filePath: input.filePath ?? null,
      fileUrl: input.fileUrl ?? null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });

  const result = await recomputeIncident(incident.id);
  await db.auditLog.create({
    data: {
      incidentId: incident.id,
      action: "evidence_attached",
      details: `Attached ${input.sourceType} evidence (${evidence.evidenceId})`,
    },
  });
  return { evidence, result };
}

/**
 * Add a responder verification (Verify/Reject/Escalate) and recompute.
 */
export async function addResponderVerification(input: {
  incidentId: string; // INC- id
  responderName: string;
  decision: "VERIFY" | "REJECT" | "ESCALATE";
  rationale?: string;
  responderId?: string;
}) {
  const incident = await db.incident.findFirst({
    where: { incidentId: input.incidentId },
  });
  if (!incident) return null;

  const decisionMap: Record<string, string> = {
    VERIFY: "Verified",
    REJECT: "Rejected",
    ESCALATE: "Needs More Evidence",
  };
  const mapped = decisionMap[input.decision];

  const verification = await db.responderVerification.create({
    data: {
      incidentId: incident.id,
      responderId: input.responderId ?? null,
      responderName: input.responderName,
      verificationStatus: mapped,
      notes: input.rationale ?? null,
      verifiedAt: new Date(),
    },
  });

  await db.incident.update({
    where: { id: incident.id },
    data: { humanStatus: mapped },
  });

  await db.auditLog.create({
    data: {
      incidentId: incident.id,
      actorId: input.responderId ?? null,
      actorRole: "officer",
      action: "responder_verified",
      details: `${input.responderName} marked incident ${mapped}`,
    },
  });

  const result = await recomputeIncident(incident.id);
  return { verification, result };
}

/**
 * Fetch the full drill-down detail for an incident, including the live
 * verification-engine evaluation.
 */
export async function getIncidentDetail(
  incidentIdStr: string
): Promise<IncidentDetail | null> {
  const incident = await db.incident.findFirst({
    where: { incidentId: incidentIdStr },
    include: {
      incidentLinks: { include: { report: true } },
      evidence: { orderBy: { createdAt: "desc" } },
      responderVerifications: { orderBy: { verifiedAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!incident) return null;

  const reports = incident.incidentLinks.map((l) => toReportType(l.report));
  const evidence = incident.evidence.map(toEvidenceType);
  const verifications = incident.responderVerifications.map(toVerificationType);

  const evaluation = evaluateIncident(reports, evidence, verifications);

  return {
    ...toIncidentType(incident),
    reports,
    evidence,
    responderVerifications: verifications,
    confidenceExplanations: evaluation.confidenceExplanations,
    priorityExplanations: evaluation.priorityExplanations,
    confidenceBreakdown: evaluation.confidenceBreakdown,
    confidenceHumanSummary: evaluation.confidenceHumanSummary,
    operationalStates: evaluation.operationalStates,
    recommendedAction: evaluation.recommendedAction,
    uniqueReports: evaluation.uniqueReports,
    duplicateReports: evaluation.duplicateReports,
  };
}

export async function getIncidentStats() {
  const incidents = await db.incident.findMany();
  const total = incidents.length;
  const count = (fn: (i: any) => boolean) =>
    incidents.filter(fn).length;
  return {
    totalIncidents: total,
    criticalIncidents: count((i) => i.priorityLevel === "Critical"),
    highPriorityIncidents: count((i) => i.priorityLevel === "High"),
    corroboratedIncidents: count((i) => i.status === "Corroborated"),
    verifiedIncidents: count((i) => i.status === "Verified"),
    pendingIncidents: count((i) => i.status === "Pending"),
    conflictedIncidents: count((i) => i.status === "Conflicted"),
    rejectedIncidents: count((i) => i.status === "Rejected"),
    staleIncidents: count((i) => i.freshnessStatus === "Stale"),
    freshIncidents: count((i) => i.freshnessStatus === "Fresh"),
    missingLocationIncidents: count((i) => i.latitude == null),
    missingEvidenceIncidents: 0, // computed below
  };
}
