import { NextRequest, NextResponse } from "next/server";
import { addResponderVerification } from "@/lib/db-ops";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { decision, responderName, rationale } = body;
  if (!decision || !responderName) {
    return NextResponse.json(
      { error: "decision and responderName are required" },
      { status: 400 }
    );
  }
  const result = await addResponderVerification({
    incidentId: id,
    decision,
    responderName,
    rationale,
  });
  if (!result) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  return NextResponse.json({
    message: "Verification recorded",
    verificationStatus: result.verification.verificationStatus,
    incidentStatus: result.result?.evaluation.status,
    priorityScore: result.result?.evaluation.priorityScore,
    confidenceScore: result.result?.evaluation.confidenceScore,
  });
}
