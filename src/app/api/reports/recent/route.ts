import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toReportType } from "@/lib/db-ops";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "10"), 50);
  const reports = await db.report.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      incidentLinks: { include: { incident: true } },
    },
  });
  const items = reports.map((r) => {
    const inc = r.incidentLinks[0]?.incident;
    return {
      ...toReportType(r),
      incidentId: inc?.incidentId ?? null,
      incidentStatus: inc?.status ?? null,
      priorityLevel: inc?.priorityLevel ?? null,
      confidenceLevel: inc?.confidenceLevel ?? null,
      priorityScore: inc?.priorityScore ?? null,
      confidenceScore: inc?.confidenceScore ?? null,
      freshness: inc?.freshnessStatus ?? null,
    };
  });
  return NextResponse.json(items);
}
