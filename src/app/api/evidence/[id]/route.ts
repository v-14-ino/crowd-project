import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let evidence = null;
  if (/^\d+$/.test(id)) {
    evidence = await db.externalEvidence.findUnique({ where: { id } });
  }
  if (!evidence) {
    evidence = await db.externalEvidence.findFirst({
      where: { evidenceId: id },
    });
  }
  if (!evidence) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }
  await db.externalEvidence.delete({ where: { id: evidence.id } });
  return NextResponse.json({ message: "Evidence deleted", evidenceId: id });
}
