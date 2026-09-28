import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addResponderVerification } from "@/lib/db-ops";

/**
 * Bulk verification: apply a single responder decision (VERIFY/REJECT/ESCALATE)
 * to multiple incidents at once.
 *
 * POST /api/incidents/bulk-verify
 * Body: { ids: ["INC-a", "INC-b"], decision: "VERIFY", responderName, rationale }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { ids, decision, responderName, rationale } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }
  if (!decision || !responderName) {
    return NextResponse.json(
      { error: "decision and responderName are required" },
      { status: 400 }
    );
  }

  const results = [];
  for (const incidentId of ids) {
    try {
      const result = await addResponderVerification({
        incidentId,
        decision,
        responderName,
        rationale: rationale || `Bulk ${decision} on ${ids.length} incidents`,
      });
      results.push({
        incidentId,
        ok: !!result,
        status: result?.result?.evaluation.status,
        confidenceScore: result?.result?.evaluation.confidenceScore,
        priorityScore: result?.result?.evaluation.priorityScore,
      });
    } catch (e: any) {
      results.push({ incidentId, ok: false, error: e.message });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({
    message: `Bulk ${decision} applied to ${succeeded}/${ids.length} incidents`,
    succeeded,
    failed: ids.length - succeeded,
    results,
  });
}
