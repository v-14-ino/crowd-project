import { NextRequest, NextResponse } from "next/server";
import { submitReport } from "@/lib/db-ops";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    category,
    issueType,
    description,
    zone,
    latitude,
    longitude,
    citizenSeverity,
    citizenName,
    conflictingEvidence,
  } = body;

  if (!category || !issueType || !citizenSeverity) {
    return NextResponse.json(
      { error: "category, issueType and citizenSeverity are required" },
      { status: 400 }
    );
  }

  const result = await submitReport({
    category,
    issueType,
    description,
    zone,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    citizenSeverity,
    citizenName,
    conflictingEvidence,
  });

  return NextResponse.json(
    {
      message: "Report submitted successfully",
      verificationStatus: result.result?.evaluation.status,
      reportId: result.report.reportId,
      incidentId: (await db.incident.findFirst({
        where: { incidentLinks: { some: { reportId: result.report.id } } },
        select: { incidentId: true },
      }))?.incidentId,
    },
    { status: 201 }
  );
}
