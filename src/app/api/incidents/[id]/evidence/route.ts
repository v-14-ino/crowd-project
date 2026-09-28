import { NextRequest, NextResponse } from "next/server";
import { attachEvidence } from "@/lib/db-ops";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = await db.incident.findFirst({
    where: { incidentId: id },
    include: { evidence: { orderBy: { createdAt: "desc" } } },
  });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  return NextResponse.json(incident.evidence);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await attachEvidence({
    incidentId: id,
    sourceType: body.sourceType || "Citizen photo",
    sourceStatus: body.sourceStatus || "Standard",
    observedAt: body.observedAt ? new Date(body.observedAt) : new Date(),
    details: body.details || "",
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    reportId: body.reportId,
  });
  if (!result) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      message: "Evidence attached",
      evidenceId: result.evidence.evidenceId,
      confidenceScore: result.result?.evaluation.confidenceScore,
      priorityScore: result.result?.evaluation.priorityScore,
      status: result.result?.evaluation.status,
      confidenceExplanations: result.result?.evaluation.confidenceExplanations,
    },
    { status: 201 }
  );
}
