import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await db.report.findFirst({
    where: { reportId: { equals: id, mode: "insensitive" } },
    include: { incidentLinks: { include: { incident: true } } },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const inc = report.incidentLinks[0]?.incident;
  return NextResponse.json({
    reportId: report.reportId,
    category: report.category,
    issueType: report.issueType,
    description: report.description,
    zone: report.zone,
    latitude: report.latitude,
    longitude: report.longitude,
    reportedTime: report.reportedTime,
    citizenSeverity: report.citizenSeverity,
    citizenName: report.citizenName,
    locationStatus: report.locationStatus,
    freshnessStatus: report.freshnessStatus,
    conflictingEvidence: report.conflictingEvidence,
    createdAt: report.createdAt,
    incidentId: inc?.incidentId ?? null,
    incidentStatus: inc?.status ?? null,
    priorityScore: inc?.priorityScore ?? null,
    priorityLevel: inc?.priorityLevel ?? null,
    confidenceScore: inc?.confidenceScore ?? null,
    confidenceLevel: inc?.confidenceLevel ?? null,
    humanStatus: inc?.humanStatus ?? null,
  });
}
