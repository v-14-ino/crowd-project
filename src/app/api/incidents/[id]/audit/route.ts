import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = await db.incident.findFirst({
    where: { incidentId: id },
    select: { id: true },
  });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  const logs = await db.auditLog.findMany({
    where: { incidentId: incident.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      actorRole: l.actorRole,
      createdAt: l.createdAt,
    }))
  );
}
