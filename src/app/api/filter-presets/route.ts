import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Filter presets are stored in the AuditLog table with action="filter_preset"
 * and details=JSON.stringify({name, filters}). This avoids a schema migration
 * while giving users named, recallable filter sets.
 *
 * GET  /api/filter-presets — list all presets
 * POST /api/filter-presets — create a preset {name, filters}
 * DELETE /api/filter-presets?id=... — delete a preset
 */

async function listPresets() {
  const logs = await db.auditLog.findMany({
    where: { action: "filter_preset" },
    orderBy: { createdAt: "desc" },
  });
  return logs.map((l) => ({
    id: l.id,
    name: l.details ? JSON.parse(l.details).name : "Unnamed preset",
    filters: l.details ? JSON.parse(l.details).filters : {},
    createdAt: l.createdAt,
  }));
}

export async function GET() {
  return NextResponse.json(await listPresets());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, filters } = body;
  if (!name || !filters) {
    return NextResponse.json(
      { error: "name and filters are required" },
      { status: 400 }
    );
  }
  const log = await db.auditLog.create({
    data: {
      action: "filter_preset",
      details: JSON.stringify({ name, filters }),
    },
  });
  return NextResponse.json(
    { id: log.id, name, filters, createdAt: log.createdAt },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await db.auditLog.delete({ where: { id } });
  return NextResponse.json({ message: "Preset deleted", id });
}
