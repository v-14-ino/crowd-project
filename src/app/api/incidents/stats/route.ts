import { NextResponse } from "next/server";
import { getIncidentStats } from "@/lib/db-ops";
import { db } from "@/lib/db";

export async function GET() {
  const stats = await getIncidentStats();
  // Compute missing-evidence incidents (those with no evidence and not verified)
  const incidentsWithoutEvidence = await db.incident.count({
    where: { evidence: { none: {} } },
  });
  return NextResponse.json({ ...stats, missingEvidenceIncidents: incidentsWithoutEvidence });
}
