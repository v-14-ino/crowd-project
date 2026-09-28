import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluateIncident } from "@/lib/verification-engine";
import {
  toReportType,
  toEvidenceType,
  toVerificationType,
  toIncidentType,
} from "@/lib/db-ops";

/**
 * Compare up to 4 incidents side-by-side: returns a compact summary of each
 * incident's key metrics + full confidence breakdown for side-by-side review.
 *
 * GET /api/incidents/compare?ids=INC-aaa,INC-bbb,INC-ccc
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (ids.length < 2) {
    return NextResponse.json(
      { error: "Provide at least 2 incident ids via ?ids=INC-a,INC-b" },
      { status: 400 }
    );
  }

  const results = [];
  for (const incidentId of ids) {
    const incident = await db.incident.findFirst({
      where: { incidentId },
      include: {
        incidentLinks: { include: { report: true } },
        evidence: true,
        responderVerifications: true,
      },
    });
    if (!incident) {
      results.push({ incidentId, notFound: true });
      continue;
    }
    const reports = incident.incidentLinks.map((l) => toReportType(l.report));
    const evidence = incident.evidence.map(toEvidenceType);
    const verifications = incident.responderVerifications.map(toVerificationType);
    const evaluation = evaluateIncident(reports, evidence, verifications);
    results.push({
      incidentId,
      incident: toIncidentType(incident),
      evaluation: {
        confidenceScore: evaluation.confidenceScore,
        confidenceLevel: evaluation.confidenceLevel,
        confidenceBreakdown: evaluation.confidenceBreakdown,
        confidenceHumanSummary: evaluation.confidenceHumanSummary,
        priorityScore: evaluation.priorityScore,
        priorityLevel: evaluation.priorityLevel,
        freshness: evaluation.freshness,
        status: evaluation.status,
        operationalStates: evaluation.operationalStates,
        recommendedAction: evaluation.recommendedAction,
        independentReports: evaluation.uniqueReports.length,
        duplicateReports: evaluation.duplicateReports.length,
      },
      evidenceCount: evidence.length,
      verificationCount: verifications.length,
    });
  }

  return NextResponse.json({ comparisons: results });
}
