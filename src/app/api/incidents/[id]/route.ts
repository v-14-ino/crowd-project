import { NextResponse } from "next/server";
import { getIncidentDetail } from "@/lib/db-ops";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getIncidentDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
